import { asBoolean, asObject } from 'cleaners'
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

/**
 * What the last REST health probe said about a connected server:
 * - `pending`: the probe has not answered yet.
 * - `healthy`: Blockbook reported `inSync: true`.
 * - `unhealthy`: Blockbook reported `inSync: false`.
 * - `unknown`: the server has no HTTP twin to probe, or the probe failed
 *   (network error, non-200, unparseable body). Never treated as unhealthy.
 */
export type ServerHealth = 'pending' | 'healthy' | 'unhealthy' | 'unknown'

export interface ServerState {
  blockbook: Blockbook
  blockSubscriptionStatus: 'unsubscribed' | 'subscribing' | 'subscribed'
  blockHeight: number
  health: ServerHealth
  /** When the last health probe was sent, ms since epoch. 0 if never. */
  lastProbeTime: number
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
  /**
   * Upper bound on any single broadcast attempt. Defaults to the same 30
   * seconds the socket layer uses for a request. Exposed for tests.
   */
  broadcastTimeoutMs?: number
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
  getServerHealth: (uri: string) => ServerHealth | undefined

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

/**
 * How long broadcastTx gives the first wave (our sockets and Edge's own HTTP
 * servers) before it also sends the transaction to the NOWNodes HTTP servers.
 * NOWNodes is a third party, so it should only see a transaction when our own
 * infrastructure has not already carried it. A first wave that fails outright
 * does not wait this long; the second wave fires as soon as it has all failed.
 */
export const NOWNODES_BROADCAST_DELAY_MS = 2000

/**
 * Every broadcast attempt is counted toward "all attempts failed", so every
 * attempt must settle. Sockets already expire a request after 30 seconds
 * (Socket.ts); HTTP has no such bound of its own, and a server that accepts
 * the connection and never answers would otherwise hold the whole broadcast
 * open. This mirrors the socket figure.
 */
export const BROADCAST_ATTEMPT_TIMEOUT_MS = 30000

/**
 * Upper bound on a REST health probe. The probe runs off the socket keepalive
 * and must never hold the connection's timer for long.
 */
export const HEALTH_PROBE_TIMEOUT_MS = 10000

/**
 * Probes closer together than this are skipped. The connect path and the
 * first keepalive can land within milliseconds of each other, and one answer
 * serves both.
 */
export const HEALTH_PROBE_MIN_INTERVAL_MS = 10000

/**
 * The part of Blockbook's REST `GET /api/` response the health probe reads.
 * The WebSocket `getInfo` message does not carry `inSync`, so the probe has
 * to go over HTTP. Blockbook itself masks the first five seconds of every
 * resync, so a `false` here means the indexer has been behind its backend
 * for longer than that, or the backend RPC is failing.
 */
const asBlockbookHealth = asObject({
  blockbook: asObject({
    inSync: asBoolean
  })
})

const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message))
    }, ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer != null) clearTimeout(timer)
  }
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
  const { broadcastTimeoutMs = BROADCAST_ATTEMPT_TIMEOUT_MS } = config
  log('Making server states')

  const serverStatesCache: ServerStatesCache = {}

  // Edge's own Blockbook servers expose both a socket and a REST endpoint on
  // the same host. Index the REST URIs by host so a socket URI can find its
  // twin for the health probe. Third-party sockets (Trezor, NOWNodes) have no
  // twin here and are never probed.
  const httpUriByHost: { [host: string]: string } = {}
  for (const serverConfig of serverConfigs) {
    if (serverConfig.type !== 'blockbook') continue
    for (const httpUri of serverConfig.uris) {
      const { host } = parse(httpUri)
      if (host != null) httpUriByHost[host] = httpUri
    }
  }

  const findHttpTwin = (uri: string): string | undefined => {
    const { host } = parse(uri)
    return host == null ? undefined : httpUriByHost[host]
  }

  const probeServerHealth = async (uri: string): Promise<ServerHealth> => {
    const httpUri = findHttpTwin(uri)
    if (httpUri == null) return 'unknown'
    const probe = async (): Promise<ServerHealth> => {
      const response = await io.fetchCors(`${httpUri}/api/`, { method: 'GET' })
      if (!response.ok) {
        log.warn(`${uri} health probe: HTTP ${response.status}`)
        return 'unknown'
      }
      const { blockbook } = asBlockbookHealth(await response.json())
      return blockbook.inSync ? 'healthy' : 'unhealthy'
    }
    try {
      // The bound covers the body too; a server can send its headers and
      // then stall:
      return await withTimeout(
        probe(),
        HEALTH_PROBE_TIMEOUT_MS,
        `Timeout for health probe to ${httpUri}`
      )
    } catch (error: unknown) {
      log.warn(`${uri} health probe failed: ${String(error)}`)
      return 'unknown'
    }
  }

  /**
   * Disconnects a server on purpose. On platforms that deliver a close event
   * for a locally closed socket (the app's WebView does) the socket's close
   * path also runs, scoring the server down and throwing its in-flight
   * requests. The refill is scheduled here regardless, so replacing the
   * connection never depends on that event arriving.
   */
  const dropServer = (uri: string, reason: string): void => {
    const serverState = serverStatesCache[uri]
    if (serverState == null) return
    log.warn(`${uri} dropped: ${reason}`)
    // Keep the refill from picking it straight back; its score is still
    // near the top since it answered every ping:
    pluginState.quarantineServer(uri)
    removeItem(serverStatesCache, uri)
    serverState.blockbook.disconnect().catch((error: unknown) => {
      log.error(`${uri} disconnect failed: ${String(error)}`)
    })
    reconnect()
    // Let the engine re-query anything this server answered:
    engineEmitter.emit(EngineEvent.SERVER_DROPPED, uri)
  }

  /**
   * Whether some other connection could carry the wallet if `uri` went
   * away: open, and not known to be out of sync. A peer whose probe has not
   * answered yet does not count; it may be about to fail the same way.
   */
  const hasUsablePeer = (uri: string): boolean =>
    Object.entries(serverStatesCache).some(
      ([otherUri, state]) =>
        otherUri !== uri &&
        state.blockbook.isConnected &&
        (state.health === 'healthy' || state.health === 'unknown')
    )

  /**
   * Drops every server known to be out of sync, as long as the wallet keeps
   * at least one usable connection. A stale server that is the only leg is
   * kept: behind the chain beats no data at all. It is re-evaluated on every
   * probe result, so it goes as soon as a usable peer shows up.
   *
   * Only one stale leg is kept. Two stale servers would otherwise keep each
   * other, filling every connection slot so the refill never reaches a
   * server that could replace them.
   */
  const dropUnhealthyServers = (): void => {
    let isStaleLegKept = false
    for (const [uri, state] of Object.entries(serverStatesCache)) {
      if (state.health !== 'unhealthy') continue
      if (!hasUsablePeer(uri) && !isStaleLegKept) {
        log.warn(
          `${uri} reports inSync: false but is the only usable connection`
        )
        isStaleLegKept = true
        continue
      }
      dropServer(uri, 'Blockbook reports inSync: false')
    }
  }

  const checkServerHealth = (uri: string): void => {
    const serverState = serverStatesCache[uri]
    if (serverState == null) return
    const now = Date.now()
    if (now - serverState.lastProbeTime < HEALTH_PROBE_MIN_INTERVAL_MS) return
    serverState.lastProbeTime = now
    probeServerHealth(uri)
      .then(health => {
        const serverState = serverStatesCache[uri]
        // The connection may have gone away while the probe was in flight:
        if (serverState == null) return
        if (serverState.health !== health) {
          log(`${uri} health: ${serverState.health} -> ${health}`)
        }
        serverState.health = health
        // This result may make this server droppable, or make it the peer
        // that lets a previously kept stale server go:
        dropUnhealthyServers()
      })
      .catch((error: unknown) => {
        log.error(`${uri} health check failed: ${String(error)}`)
      })
  }
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
      // Periodic probe, once per keepalive:
      checkServerHealth(uri)
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
      const serverState = serverStatesCache[uri]
      // The connection may already be gone, as the sibling handler above
      // allows for:
      if (serverState == null) return
      serverState.blockHeight = blockHeight
    }
  )

  let pickNextTaskCB: (
    uri: string
  ) => AsyncGenerator<WsTask<unknown> | boolean, boolean>

  const makeServerStatesCacheEntry = (
    uri: string,
    blockbook: Blockbook
  ): ServerState => ({
    blockbook,
    blockSubscriptionStatus: 'unsubscribed',
    txids: new Set(),
    addresses: new Set(),
    blockHeight: 0,
    health: findHttpTwin(uri) == null ? 'unknown' : 'pending',
    lastProbeTime: 0
  })

  const reconnect = (): void => {
    if (isEngineOn) {
      log(`attempting server reconnect number ${reconnectCounter}`)
      const reconnectionDelay = Math.max(5, reconnectCounter++) * 1000
      // One pending reconnect at a time. A drop and the close event it
      // causes both land here, and a timer that was overwritten rather than
      // cleared would outlive stop() and switch the engine back on.
      clearTimeout(reconnectTimer)
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

      // The list may predate a quarantine:
      if (pluginState.isServerQuarantined(uri)) continue

      // Validate the URI of server to make sure it is valid
      const parsed = parse(uri)
      if (
        parsed.scheme == null ||
        parsed.scheme.length < 2 ||
        parsed.host == null
      ) {
        continue
      }

      // Randomize the URI picking
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

        let result: IteratorResult<
          WsTask<unknown> | boolean,
          boolean
        > = await generator.next()

        while (true) {
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
          try {
            const nextValue = yield task
            result = await generator.next(nextValue)
          } catch (error) {
            // Delegate the error handling to the task generator:
            result = await generator.throw(error).catch(error => {
              // If unhandled, log the error up to the core:
              log.error(error)
              // End the task generator routine (task threw unhandled error)
              return { done: true, value: false }
            })
          }
        }
      }

      // Create a new blockbook instance based on the URI scheme
      if (['electrumwss', 'electrumws'].includes(parsed.scheme)) {
        // Electrum wrapper
        blockbook = makeBlockbookElectrum({
          asAddress: pluginInfo.engineInfo.asBlockbookAddress,
          connectionUri: uri,
          engineEmitter,
          initOptions,
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
          initOptions,
          log,
          taskGeneratorFn,
          socketEmitter,
          walletId: walletInfo.id
        })
      }

      // Make new ServerStates instance
      serverStatesCache[uri] = makeServerStatesCacheEntry(uri, blockbook)

      // Initialize blockbook connection for server
      blockbook
        .connect()
        .then(async () => {
          // This connection is now open and counts as a usable peer, which
          // may be what a stale server kept for lack of one was waiting on.
          // Done here rather than on the socket's open event, which fires
          // before the connect promise marks the blockbook connected:
          dropUnhealthyServers()

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

          // On-connect probe. The keepalive may or may not have fired by
          // now, depending on how fast the socket opened, so this is the
          // one place that guarantees a probe before the server does work:
          checkServerHealth(uri)
        })
        .catch(e => {
          log.error(`${JSON.stringify(e.message)}`)
        })
    }

    // A quarantined server is withheld from the candidate list, so a wallet
    // left short of connections would otherwise stay that way until an
    // unrelated close event. Keep trying while a quarantine is in force; the
    // server comes back into the list when it expires. The reconnect delay
    // grows with each empty pass, so this does not spin.
    if (
      Object.keys(serverStatesCache).length < MAX_CONNECTIONS &&
      serverList.length === 0 &&
      pluginState.hasQuarantinedServers()
    ) {
      reconnect()
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
    /**
     * Broadcast in two waves:
     *
     * 1. Immediately: every blockbook in the connection cache (whether or not
     *    its socket has finished connecting; a queued request transmits as
     *    soon as the socket opens, and times out otherwise) and every
     *    `blockbook` HTTP server, which are Edge's own.
     * 2. After NOWNODES_BROADCAST_DELAY_MS, or as soon as every first-wave
     *    attempt has failed, whichever comes first: the `blockbook-nownode`
     *    HTTP servers. These are a third party and only see the transaction
     *    when our own infrastructure has not already carried it.
     *
     * The first success wins. The promise rejects only after every attempt
     * has failed. Earlier versions only used HTTP when no socket was
     * connected, so a single socket that looked connected but never answered
     * could fail the whole broadcast without any HTTP attempt.
     */
    async broadcastTx(transaction: EdgeTransaction): Promise<string> {
      return await new Promise((resolve, reject) => {
        interface Attempt {
          uri: string
          run: () => Promise<string>
        }

        const httpAttempt = (
          uri: string,
          headers: { [key: string]: string }
        ): Attempt => ({
          uri,
          run: async () => {
            const response = await io.fetchCors(`${uri}/api/v2/sendtx/`, {
              method: 'POST',
              headers,
              body: transaction.signedTx
            })
            if (!response.ok) {
              throw new Error(
                `Failed to broadcast transaction via Blockbook: HTTP ${response.status}`
              )
            }
            const json = await response.json()
            return asBlockbookResponse(asBroadcastTxResponse)(json).result
          }
        })

        //
        // Build both waves up front, so `attempts` is the full count and an
        // all-fail first wave cannot reject before the second has run.
        //
        const firstWave: Attempt[] = []
        const secondWave: Attempt[] = []

        for (const uri of Object.keys(serverStatesCache)) {
          const { blockbook } = serverStatesCache[uri]
          if (blockbook == null) continue
          firstWave.push({
            uri,
            run: async () => (await blockbook.broadcastTx(transaction)).result
          })
        }

        // This is for the future when we want to get HTTP servers from the user
        // settings:
        // const httpUris = pluginState.getLocalServers(Infinity, [
        //   /^http(?:s)?:/i
        // ])
        const { nowNodesApiKey } = initOptions
        for (const config of serverConfigs) {
          if (config.type === 'blockbook-nownode') {
            // NOWNodes requires the key, and the key must not go anywhere else:
            if (nowNodesApiKey == null) {
              log.warn(
                'broadcastTx: skipping NOWNodes HTTP servers (no nowNodesApiKey)'
              )
              continue
            }
            for (const uri of config.uris) {
              secondWave.push(httpAttempt(uri, { 'api-key': nowNodesApiKey }))
            }
          } else {
            for (const uri of config.uris) {
              firstWave.push(httpAttempt(uri, {}))
            }
          }
        }

        const attempts = firstWave.length + secondWave.length
        if (attempts === 0) {
          reject(
            new Error('No available connections. Check your internet signal.')
          )
          return
        }

        let resolved = false
        let failures = 0
        const failureMessages: string[] = []
        let secondWaveFired = false
        let secondWaveTimer: ReturnType<typeof setTimeout> | undefined

        const onSuccess = (uri: string, txid: string): void => {
          if (resolved) return
          resolved = true
          if (secondWaveTimer != null) clearTimeout(secondWaveTimer)
          log(`broadcastTx succeeded via ${uri}: ${txid}`)
          resolve(txid)
        }
        const onFailure = (uri: string, error: unknown): void => {
          const message = error instanceof Error ? error.message : String(error)
          failureMessages.push(`${uri}: ${message}`)
          log.warn(`broadcastTx attempt failed for ${uri}: ${message}`)
          failures++
          if (resolved) return
          if (failures === attempts) {
            log.error(
              `broadcastTx fail: ${JSON.stringify(
                transaction
              )}\n${failureMessages.join('\n')}`
            )
            reject(
              error instanceof Error
                ? error
                : new Error(`Broadcast failed: ${failureMessages.join('; ')}`)
            )
            return
          }
          // Every first-wave attempt has failed, so there is nothing left to
          // wait for. Fire the second wave now rather than sit out the delay.
          if (!secondWaveFired && failures >= firstWave.length) {
            fireSecondWave()
          }
        }
        const fire = (attempt: Attempt): void => {
          withTimeout(
            attempt.run(),
            broadcastTimeoutMs,
            `Timeout for broadcast to ${attempt.uri}`
          )
            .then(txid => {
              onSuccess(attempt.uri, txid)
            })
            .catch((error: unknown) => {
              onFailure(attempt.uri, error)
            })
        }
        const fireSecondWave = (): void => {
          if (secondWaveFired) return
          secondWaveFired = true
          if (secondWaveTimer != null) clearTimeout(secondWaveTimer)
          if (secondWave.length === 0) return
          log.warn(
            'broadcastTx: first wave has not resolved, trying NOWNodes servers'
          )
          for (const attempt of secondWave) fire(attempt)
        }

        for (const attempt of firstWave) fire(attempt)
        if (firstWave.length === 0) {
          // Nothing of our own to try first:
          fireSecondWave()
        } else if (secondWave.length > 0) {
          secondWaveTimer = setTimeout(
            fireSecondWave,
            NOWNODES_BROADCAST_DELAY_MS
          )
        }
      })
    },

    getBlockHeight(uri: string): number {
      return serverStatesCache[uri].blockHeight
    },

    getServerHealth(uri: string): ServerHealth | undefined {
      return serverStatesCache[uri]?.health
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
