import { EdgeIo, EdgeLog, EdgeTransaction } from 'edge-core-js/types'
import { parse } from 'uri-js'

import { EngineEmitter, EngineEvent } from '../../plugin/EngineEmitter'
import { PluginState } from '../../plugin/PluginState'
import { PluginInfo } from '../../plugin/types'
import { removeItem } from '../../plugin/utils'
import { SafeWalletInfo } from '../keymanager/cleaners'
import { Blockbook, makeBlockbook } from '../network/Blockbook'
import {
  AddressResponse,
  AddressUtxosResponse,
  asBlockbookResponse,
  asBroadcastTxResponse,
  BlockbookTransaction,
  SubscribeAddressResponse
} from '../network/blockbookApi'
import { makeBlockbookElectrum } from '../network/BlockbookElectrum'
import Deferred from '../network/Deferred'
import { WsTask, WsTaskGenerator } from '../network/Socket'
import { SocketEmitter, SocketEvent } from '../network/SocketEmitter'
import { pushUpdate, removeIdFromQueue } from '../network/socketQueue'
import { MAX_CONNECTIONS, NEW_CONNECTIONS } from './constants'
import { UtxoInitOptions } from './types'

export interface ServerState {
  blockbook: Blockbook
  blockSubscriptionStatus: 'unsubscribed' | 'subscribing' | 'subscribed'
  blockHeight: number
  txids: Set<string>
  addresses: Set<string>
}

interface ServerStateConfig {
  engineEmitter: EngineEmitter
  initOptions: UtxoInitOptions
  io: EdgeIo
  log: EdgeLog
  pluginInfo: PluginInfo
  pluginState: PluginState
  walletInfo: SafeWalletInfo
}

export interface ServerStates {
  setPickNextTaskCB: (
    callback: (uri: string) => AsyncGenerator<WsTask<unknown> | boolean>
  ) => void
  stop: () => void
  serverCanGetTx: (uri: string, txid: string) => boolean
  serverCanGetAddress: (uri: string, address: string) => boolean
  serverIsAwareOfAddress: (uri: string, address: string) => boolean
  getServerState: (uri: string) => ServerState | undefined
  refillServers: () => void
  getServerList: () => string[]
  setServerList: (updatedServerList: string[]) => void
  broadcastTx: (transaction: EdgeTransaction) => Promise<string>
  watchAddresses: (
    uri: string,
    addresses: string[],
    deferredAddressSub?: Deferred<unknown>
  ) => void
  watchBlocks: (uri: string) => void
  getBlockHeight: (uri: string) => number

  //
  // Task Methods:
  //

  addressQueryTask: (
    serverUri: string,
    address: string,
    params: { lastQueriedBlockHeight: number; page: number }
  ) => WsTaskGenerator<AddressResponse>

  transactionQueryTask: (
    serverUri: string,
    txId: string
  ) => WsTaskGenerator<BlockbookTransaction>

  transactionSpecialQueryTask: (
    serverUri: string,
    txId: string
  ) => WsTaskGenerator<unknown>

  utxoListQueryTask: (
    serverUri: string,
    address: string
  ) => WsTaskGenerator<AddressUtxosResponse>
}

interface ServerStatesCache {
  [uri: string]: ServerState
}

export function makeServerStates(config: ServerStateConfig): ServerStates {
  const {
    engineEmitter,
    initOptions,
    io,
    log,
    pluginInfo,
    pluginState,
    walletInfo
  } = config
  const { serverConfigs = [] } = pluginInfo.engineInfo
  log('Making server states')

  const serverStatesCache: ServerStatesCache = {}
  let isEngineOn: boolean = true
  let serverList: string[] = []
  let reconnectCounter = 0
  let reconnectTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
    return
  }, 0)
  const socketEmitter = new SocketEmitter()

  // set server specific event emitters
  socketEmitter.on(SocketEvent.CONNECTION_OPEN, (uri: string) => {
    reconnectCounter = 0
    log(`${uri} ** Connected **`)
  })
  socketEmitter.on(
    SocketEvent.CONNECTION_CLOSE,
    (uri: string, error?: Error) => {
      removeItem(serverStatesCache, uri)

      const msg =
        error != null ? ` !! Connection ERROR !! ${error.message}` : ''
      log(`${uri} onClose ${msg}`)
      if (error != null) {
        pluginState.serverScoreDown(uri)
      }
      reconnect()
    }
  )
  socketEmitter.on(
    SocketEvent.CONNECTION_TIMER,
    (uri: string, queryDate: number) => {
      const queryTime = Date.now() - queryDate
      log(`${uri} returned healthCheck in ${queryTime}ms`)
      pluginState.serverScoreUp(uri, queryTime)
    }
  )
  engineEmitter.on(
    EngineEvent.NEW_ADDRESS_TRANSACTION,
    (uri: string, newTx: SubscribeAddressResponse) => {
      log(
        `${uri} received received new transaction with id ${newTx.tx.txid} to address ${newTx.address}`
      )
      const serverState = serverStatesCache[uri]
      if (serverState != null) {
        serverState.txids.add(newTx.tx.txid)
      }
    }
  )
  engineEmitter.on(
    EngineEvent.BLOCK_HEIGHT_CHANGED,
    (uri: string, blockHeight: number) => {
      log(`${uri} block height changed to ${blockHeight}`)
      serverStatesCache[uri].blockHeight = blockHeight
    }
  )

  let pickNextTaskCB: (
    uri: string
  ) => AsyncGenerator<WsTask<unknown> | boolean, boolean>

  const makeServerStatesCacheEntry = (blockbook: Blockbook): ServerState => ({
    blockbook,
    blockSubscriptionStatus: 'unsubscribed',
    txids: new Set(),
    addresses: new Set(),
    blockHeight: 0
  })

  const reconnect = (): void => {
    if (isEngineOn) {
      log(`attempting server reconnect number ${reconnectCounter}`)
      const reconnectionDelay = Math.max(5, reconnectCounter++) * 1000
      reconnectTimer = setTimeout(() => {
        clearTimeout(reconnectTimer)
        instance.refillServers()
      }, reconnectionDelay)
    }
  }

  const doRefillServers = (): void => {
    const includePatterns = ['wss:', 'ws:', 'electrumwss:', 'electrumws:']
    if (serverList.length === 0) {
      serverList = pluginState.getLocalServers(NEW_CONNECTIONS, includePatterns)
    }
    log(`refillServers: Top ${NEW_CONNECTIONS} servers:`, serverList)
    let chanceToBePicked = 1.25
    while (Object.keys(serverStatesCache).length < MAX_CONNECTIONS) {
      if (serverList.length === 0) break
      const uri = serverList.shift()
      if (uri == null) {
        reconnect()
        break
      }

      // Skip reconnecting to an existing connection
      if (serverStatesCache[uri] != null) continue

      // Validate the URI of server to make sure it is valid
      const parsed = parse(uri)
      if (
        parsed.scheme == null ||
        parsed.scheme.length < 2 ||
        parsed.host == null
      ) {
        continue
      }

      // Ranomize the URI picking
      chanceToBePicked -= chanceToBePicked > 0.5 ? 0.25 : 0
      if (Math.random() > chanceToBePicked) {
        serverList.push(uri)
        continue
      }

      // Blockbook instance variable
      let blockbook: Blockbook

      // Queue space callback
      async function* taskGeneratorFn(): AsyncGenerator<
        WsTask<unknown> | boolean,
        boolean
      > {
        // Exit if the connection is no longer active
        if (uri == null || !(uri in serverStatesCache)) return false

        const generator = pickNextTaskCB(uri)
        let nextValue: unknown
        while (true) {
          const result: IteratorResult<
            WsTask<unknown> | boolean,
            boolean
          > = await generator.next(nextValue)

          if (result?.done === true) {
            return result.value
          }

          const task = result.value

          if (typeof task !== 'boolean') {
            const taskMessage = `${task.method} params: ${JSON.stringify(
              task.params
            )}`
            log(`${uri} nextTask: ${taskMessage}`)
          }
          nextValue = yield task
        }
      }

      // Create a new blockbook instance based on the URI scheme
      if (['electrumwss', 'electrumws'].includes(parsed.scheme)) {
        // Electrum wrapper
        blockbook = makeBlockbookElectrum({
          asAddress: pluginInfo.engineInfo.asBlockbookAddress,
          connectionUri: uri,
          engineEmitter,
          log,
          taskGeneratorFn,
          pluginInfo,
          socketEmitter,
          walletId: walletInfo.id
        })
      } else {
        // Regular blockbook instance
        blockbook = makeBlockbook({
          asAddress: pluginInfo.engineInfo.asBlockbookAddress,
          connectionUri: uri,
          engineEmitter,
          log,
          taskGeneratorFn,
          socketEmitter,
          walletId: walletInfo.id
        })
      }

      // Make new ServerStates instance
      serverStatesCache[uri] = makeServerStatesCacheEntry(blockbook)

      // Initialize blockbook connection for server
      blockbook
        .connect()
        .then(async () => {
          // Fetch block height from blockbook server
          const startTime = Date.now()
          const { bestHeight: blockHeight } = await blockbook.fetchInfo()
          log('height:', blockHeight)

          // Update server state
          serverStatesCache[uri].blockHeight = blockHeight

          // Emit initial BLOCK_HEIGHT_CHANGED event
          engineEmitter.emit(EngineEvent.BLOCK_HEIGHT_CHANGED, uri, blockHeight)

          // Increment server score using response time
          const responseTime = Date.now() - startTime
          pluginState.serverScoreUp(uri, responseTime)
        })
        .catch(e => {
          log.error(`${JSON.stringify(e.message)}`)
        })
    }
  }

  const deferredWithServerScoring = <T>(
    serverUri: string,
    deferred: Deferred<T>
  ): Deferred<T> => {
    const serverState = serverStatesCache[serverUri]
    if (serverState == null)
      throw new Error(`No blockbook connection with ${serverUri}`)

    const queryTime = Date.now()
    const deferredWithScoring = new Deferred<T>()
    deferredWithScoring.promise.then(
      (value: T) => {
        pluginState.serverScoreUp(serverUri, Date.now() - queryTime)
        deferred.resolve(value)
      },
      (err: unknown) => {
        pluginState.serverScoreDown(serverUri)
        deferred.reject(err)
      }
    )

    return deferredWithScoring
  }

  function* withServerScoring<T, R>(
    serverUri: string,
    generator: Generator<T, R>
  ): Generator<T, R> {
    const serverState = serverStatesCache[serverUri]
    if (serverState == null)
      throw new Error(`No blockbook connection with ${serverUri}`)

    const queryTime = Date.now()
    let result: R
    try {
      result = yield* generator
      pluginState.serverScoreUp(serverUri, Date.now() - queryTime)
    } catch (error: unknown) {
      pluginState.serverScoreDown(serverUri)
      throw error
    }
    return result
  }

  const instance: ServerStates = {
    async broadcastTx(transaction: EdgeTransaction): Promise<string> {
      return await new Promise((resolve, reject) => {
        let resolved = false
        let bad = 0

        const wsUris = Object.keys(serverStatesCache).filter(
          uri => serverStatesCache[uri].blockbook != null
        )

        // If there are no blockbook instances, reject the promise
        if (wsUris.length < 1) {
          reject(new Error('Unexpected error. Missing WebSocket connections.'))
          // Exit early if there are blockbook instances
          return
        }

        // Determine if there are any connected blockbook instances
        const isAnyBlockbookConnected = wsUris.some(
          uri => serverStatesCache[uri].blockbook.isConnected
        )

        if (isAnyBlockbookConnected) {
          for (const uri of wsUris) {
            const { blockbook } = serverStatesCache[uri]
            if (blockbook == null) continue
            blockbook
              .broadcastTx(transaction)
              .then(response => {
                if (!resolved) {
                  resolved = true
                  resolve(response.result)
                }
              })
              .catch((e?: Error) => {
                if (++bad === wsUris.length) {
                  const msg = e != null ? `With error ${e.message}` : ''
                  log.error(
                    `broadcastTx fail: ${JSON.stringify(transaction)}\n${msg}`
                  )
                  reject(e)
                }
              })
          }
        }

        // Broadcast through any HTTP URI that may be configured, only if no
        // blockbook instances are connected.
        if (!isAnyBlockbookConnected) {
          // This is for the future when we want to get HTTP servers from the user
          // settings:
          // const httpUris = pluginState.getLocalServers(Infinity, [
          //   /^http(?:s)?:/i
          // ])

          const { nowNodeApiKey } = initOptions
          const nowNodeUris = serverConfigs
            .filter(config => config.type === 'blockbook-nownode')
            .map(config => config.uris)
            .flat(1)

          // If there are no HTTP servers, reject the promise
          if (nowNodeUris.length < 1) {
            // If no HTTP servers are available, and we had no connected blockbook
            // instances, reject the promise with a message indicating no
            // available connections. It's clear we have some connection instances
            // if we gotten to this point, but we just don't have any of those
            // instances connected at this time.
            reject(
              new Error('No available connections. Check your internet signal.')
            )
            return
          }

          // If there is no key for the NowNode servers:
          if (nowNodeApiKey == null) {
            reject(new Error('Missing connection key for fallback servers.'))
            return
          }

          for (const uri of nowNodeUris) {
            log.warn('Falling back to NOWNode server broadcast over HTTP:', uri)

            // HTTP Fallback
            io.fetchCors(`${uri}/api/v2/sendtx/`, {
              method: 'POST',
              headers: {
                'api-key': nowNodeApiKey
              },
              body: transaction.signedTx
            })
              .then(async response => {
                if (!response.ok) {
                  throw new Error(
                    `Failed to broadcast transaction via Blockbook: HTTP ${response.status}`
                  )
                }
                const json = await response.json()
                return asBlockbookResponse(asBroadcastTxResponse)(json)
              })
              .then(response => {
                if (!resolved) {
                  resolved = true
                  resolve(response.result)
                }
              })
              .catch((e?: Error) => {
                if (++bad === nowNodeUris.length) {
                  const msg = e != null ? `With error ${e.message}` : ''
                  log.error(
                    `broadcastTx fail: ${JSON.stringify(transaction)}\n${msg}`
                  )
                  reject(e)
                }
              })
          }
        }
      })
    },

    getBlockHeight(uri: string): number {
      return serverStatesCache[uri].blockHeight
    },

    getServerList(): string[] {
      return serverList
    },

    getServerState(uri: string): ServerState | undefined {
      return serverStatesCache[uri]
    },

    refillServers(): void {
      log(`refilling servers...`)
      isEngineOn = true
      pushUpdate({
        id: walletInfo.id,
        updateFunc: () => {
          doRefillServers()
        }
      })
    },

    setPickNextTaskCB(callback): void {
      pickNextTaskCB = callback
    },

    setServerList(updatedServerList: string[]): void {
      serverList = updatedServerList
    },

    serverCanGetTx(uri: string, txid: string): boolean {
      const serverState = serverStatesCache[uri]
      if (serverState == null) return false
      if (serverState.txids.has(txid)) return true

      for (const state of Object.values(serverStatesCache)) {
        if (state.txids.has(txid)) return false
      }
      return true
    },

    serverCanGetAddress(uri: string, address: string): boolean {
      const serverState = serverStatesCache[uri]
      if (serverState == null) return false
      if (serverState.addresses.has(address)) return true

      for (const state of Object.values(serverStatesCache)) {
        if (state.addresses.has(address)) return false
      }
      return true
    },

    serverIsAwareOfAddress(uri: string, address: string): boolean {
      const serverState = serverStatesCache[uri]
      if (serverState == null) return false
      if (serverState.addresses.has(address)) return true
      return false
    },

    async stop(): Promise<void> {
      isEngineOn = false
      log(`stopping server states`)
      removeIdFromQueue(walletInfo.id)
      clearTimeout(reconnectTimer)
      for (const uri of Object.keys(serverStatesCache)) {
        const serverState = serverStatesCache[uri]
        const { blockbook } = serverState
        if (blockbook == null) continue
        await blockbook.disconnect()
        removeItem(serverStatesCache, uri)
      }
    },

    watchAddresses(
      serverUri: string,
      addresses: string[],
      deferredAddressSub?: Deferred<unknown>
    ): void {
      const serverState = serverStatesCache[serverUri]
      if (serverState == null)
        throw new Error(`No blockbook connection with ${serverUri}`)

      const { blockbook } = serverState

      // Add new addresses to the set of known addresses
      for (const address of addresses) {
        serverState.addresses.add(address)
      }

      const deferred = new Deferred<unknown>()
      deferred.promise.catch((err: unknown) => {
        // Remove new addresses to the set of known addresses
        for (const address of addresses) {
          serverState.addresses.delete(address)
        }
        // Reject the deferredAddressSub promise if provided
        deferredAddressSub?.reject(err)
      })

      blockbook.watchAddresses(
        Array.from(serverState.addresses),
        deferredWithServerScoring(serverUri, deferred)
      )
    },

    watchBlocks(serverUri: string): void {
      const serverState = serverStatesCache[serverUri]
      if (serverState == null)
        throw new Error(`No blockbook connection with ${serverUri}`)

      const { blockbook } = serverState

      serverState.blockSubscriptionStatus = 'subscribing'

      const deferred = new Deferred()
      deferred.promise
        .then(() => {
          serverState.blockSubscriptionStatus = 'subscribed'
        })
        .catch(() => {
          serverState.blockSubscriptionStatus = 'unsubscribed'
        })
      blockbook.watchBlocks(deferredWithServerScoring(serverUri, deferred))
    },

    //
    // Task Methods:
    //

    addressQueryTask: function* (
      serverUri: string,
      address: string,
      params: { lastQueriedBlockHeight: number; page: number }
    ) {
      const serverState = serverStatesCache[serverUri]
      if (serverState == null)
        throw new Error(`No blockbook connection with ${serverUri}`)

      return yield* withServerScoring(
        serverUri,
        (function* () {
          return yield* serverState.blockbook.addressQueryTask(address, {
            asBlockbookAddress: pluginInfo.engineInfo.asBlockbookAddress,
            lastQueriedBlockHeight: params.lastQueriedBlockHeight,
            page: params.page
          })
        })()
      )
    },

    transactionQueryTask: function* (serverUri: string, txId: string) {
      const serverState = serverStatesCache[serverUri]
      if (serverState == null)
        throw new Error(`No blockbook connection with ${serverUri}`)

      return yield* withServerScoring(
        serverUri,
        (function* () {
          return yield* serverState.blockbook.transactionQueryTask(txId)
        })()
      )
    },

    transactionSpecialQueryTask: function* (serverUri: string, txId: string) {
      const serverState = serverStatesCache[serverUri]
      if (serverState == null)
        throw new Error(`No blockbook connection with ${serverUri}`)

      return yield* withServerScoring(
        serverUri,
        (function* () {
          return serverState.blockbook.transactionSpecialQueryTask(txId)
        })()
      )
    },
    utxoListQueryTask: function* (serverUri: string, address: string) {
      const serverState = serverStatesCache[serverUri]
      if (serverState == null)
        throw new Error(`No blockbook connection with ${serverUri}`)

      return yield* withServerScoring(
        serverUri,
        (function* () {
          return yield* serverState.blockbook.utxoListQueryTask(address, {
            asBlockbookAddress: pluginInfo.engineInfo.asBlockbookAddress
          })
        })()
      )
    }
  }

  return instance
}
