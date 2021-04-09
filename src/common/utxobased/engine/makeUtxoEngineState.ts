import * as bs from 'biggystring'
import {
  EdgeFreshAddress,
  EdgeIo,
  EdgeLog,
  EdgeTransaction,
  EdgeWalletInfo
} from 'edge-core-js'
import { parse } from 'uri-js'

import { EngineEmitter, EngineEvent } from '../../plugin/makeEngineEmitter'
import { PluginState } from '../../plugin/pluginState'
import {
  AddressPath,
  CurrencyFormat,
  EngineConfig,
  EngineCurrencyInfo,
  NetworkEnum
} from '../../plugin/types'
import { Processor } from '../db/makeProcessor'
import { IAddress, IProcessorTransaction, IUTXO } from '../db/types'
import { BIP43PurposeTypeEnum, ScriptTypeEnum } from '../keymanager/keymanager'
import {
  BlockBook,
  IAccountDetailsBasic,
  IAccountUTXO,
  INewTransactionResponse,
  ITransaction,
  ITransactionDetailsPaginationResponse,
  makeBlockBook
} from '../network/BlockBook'
import {
  addressMessage,
  addressUtxosMessage,
  transactionMessage
} from '../network/BlockBookAPI'
import Deferred from '../network/Deferred'
import { WsTask } from '../network/Socket'
import { pushUpdate, removeIdFromQueue } from '../network/socketQueue'
import {
  BLOCKBOOK_TXS_PER_PAGE,
  CACHE_THROTTLE,
  MAX_CONNECTIONS,
  NEW_CONNECTIONS
} from './constants'
import { UTXOPluginWalletTools } from './makeUtxoWalletTools'
import { makeMutexor, Mutexor } from './mutexor'
import {
  currencyFormatToPurposeType,
  getCurrencyFormatFromPurposeType,
  getFormatSupportedBranches,
  getPurposeTypeFromKeys,
  getWalletSupportedFormats,
  validScriptPubkeyFromAddress
} from './utils'

export interface UtxoEngineState {
  processedPercent: number
  serverList: string[]

  start: () => Promise<void>

  stop: () => Promise<void>

  getFreshAddress: (branch?: number) => Promise<EdgeFreshAddress>

  addGapLimitAddresses: (addresses: string[]) => Promise<void>

  broadcastTx: (transaction: EdgeTransaction) => Promise<string>

  refillServers: () => void
}

export interface UtxoEngineStateConfig extends EngineConfig {
  walletTools: UTXOPluginWalletTools
  processor: Processor
}

interface ServerState {
  subscribedBlocks: boolean
  txids: Set<string>
  addresses: Set<string>
}

export function makeUtxoEngineState(
  config: UtxoEngineStateConfig
): UtxoEngineState {
  const {
    network,
    currencyInfo,
    walletInfo,
    walletTools,
    options: { emitter, log },
    processor,
    pluginState
  } = config

  const taskCache: TaskCache = {
    addressWatching: false,
    blockWatching: false,
    addressSubscribeCache: new Map(),
    transactionsCache: new Map(),
    utxosCache: new Map(),
    rawUtxosCache: new Map(),
    processedUtxosCache: new Map(),
    updateTransactionsCache: new Map()
  }

  let processedCount = 0
  let processedPercent = 0
  const onAddressChecked = async (): Promise<void> => {
    processedCount = processedCount + 1
    const totalCount = await getTotalAddressCount({
      walletInfo,
      currencyInfo,
      processor
    })
    const percent = processedCount / totalCount
    log('processed', percent)
    if (percent - processedPercent > CACHE_THROTTLE || percent === 1) {
      processedPercent = percent
      emitter.emit(EngineEvent.ADDRESSES_CHECKED, percent)
    }
  }

  const mutexor = makeMutexor()
  const connections = new Map<string, BlockBook>()
  const serverList: string[] = []
  const reconnectCounter = 0
  const reconnectTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
    return
  }, 0)
  const engineStarted = false
  const serverStates = new Map<string, ServerState>()

  const commonArgs: CommonArgs = {
    engineStarted,
    network,
    currencyInfo,
    walletInfo,
    walletTools,
    processor,
    emitter,
    taskCache,
    onAddressChecked,
    mutexor,
    serverList,
    connections,
    pluginState,
    io: config.io,
    log,
    reconnectCounter,
    reconnectTimer,
    serverStates
  }

  let running = false
  const run = async (): Promise<void> => {
    if (running) return
    running = true

    const formatsToProcess = getWalletSupportedFormats(walletInfo)
    for (const format of formatsToProcess) {
      const branches = getFormatSupportedBranches(format)
      for (const branch of branches) {
        const args: SetLookAheadArgs = {
          ...commonArgs,
          format,
          branch
        }
        await setLookAhead(args)
      }
    }
  }

  return {
    processedPercent,
    serverList,
    async start(): Promise<void> {
      processedCount = 0
      processedPercent = 0

      await run()
      refillServers(commonArgs)
    },

    async stop(): Promise<void> {
      removeIdFromQueue(walletInfo.id)
      clearTimeout(reconnectTimer)
      for (const uri of connections.keys()) {
        const blockBook = connections.get(uri)
        if (blockBook == null) continue
        await blockBook.disconnect()
      }
    },

    async getFreshAddress(branch = 0): Promise<EdgeFreshAddress> {
      const walletPurpose = getPurposeTypeFromKeys(walletInfo)
      if (walletPurpose === BIP43PurposeTypeEnum.Segwit) {
        const { address: publicAddress } = await internalGetFreshAddress({
          ...commonArgs,
          format: getCurrencyFormatFromPurposeType(
            BIP43PurposeTypeEnum.WrappedSegwit
          ),
          branch: branch
        })

        const { address: segwitAddress } = await internalGetFreshAddress({
          ...commonArgs,
          format: getCurrencyFormatFromPurposeType(BIP43PurposeTypeEnum.Segwit),
          branch: branch
        })

        return {
          publicAddress,
          segwitAddress
        }
      } else {
        // Airbitz wallets only use branch 0
        if (walletPurpose !== BIP43PurposeTypeEnum.Airbitz) {
          branch = 0
        }

        const {
          address: publicAddress,
          legacyAddress
        } = await internalGetFreshAddress({
          ...commonArgs,
          format: getCurrencyFormatFromPurposeType(walletPurpose),
          branch: branch
        })

        return {
          publicAddress,
          legacyAddress:
            legacyAddress !== publicAddress ? legacyAddress : undefined
        }
      }
    },

    async addGapLimitAddresses(addresses: string[]): Promise<void> {
      for (const addr of addresses) {
        await saveAddress({
          ...commonArgs,
          scriptPubkey: walletTools.addressToScriptPubkey(addr),
          used: true
        })
      }
      await run()
    },

    async broadcastTx(transaction: EdgeTransaction): Promise<string> {
      return await new Promise((resolve, reject) => {
        const uris = Object.keys(connections).filter(uri => {
          const blockBook = connections.get(uri)
          if (blockBook == null) return false
          return blockBook.isConnected
        })
        if (uris == null || uris.length < 1) {
          reject(
            new Error('No available connections\nCheck your internet signal')
          )
        }
        let resolved = false
        let bad = 0
        for (const uri of uris) {
          const blockBook = connections.get(uri)
          if (blockBook == null) continue
          blockBook
            .broadcastTx(transaction)
            .then(response => {
              if (!resolved) {
                resolved = true
                resolve(response.result)
              }
            })
            .catch((e?: Error) => {
              if (++bad === uris.length) {
                const msg = e != null ? `With error ${e.message}` : ''
                log.error(
                  `broadcastTx fail: ${JSON.stringify(transaction)}\n${msg}`
                )
                reject(e)
              }
            })
        }
      })
    },

    refillServers() {
      refillServers(commonArgs)
    }
  }
}

interface CommonArgs {
  engineStarted: boolean
  network: NetworkEnum
  currencyInfo: EngineCurrencyInfo
  walletInfo: EdgeWalletInfo
  walletTools: UTXOPluginWalletTools
  processor: Processor
  emitter: EngineEmitter
  taskCache: TaskCache
  onAddressChecked: () => void
  mutexor: Mutexor
  pluginState: PluginState
  serverList: string[]
  io: EdgeIo
  log: EdgeLog
  connections: Map<string, BlockBook>
  reconnectCounter: number
  reconnectTimer: ReturnType<typeof setTimeout>
  serverStates: Map<string, ServerState>
}

interface ShortPath {
  format: CurrencyFormat
  branch: number
}
interface TaskCache {
  addressWatching: boolean
  blockWatching: boolean
  addressSubscribeCache: Map<string, CommonCacheState>
  utxosCache: Map<string, CommonCacheState>
  rawUtxosCache: Map<IAccountUTXO, RawUtxoCacheState>
  processedUtxosCache: Map<IAddress, ProcessedUtxoCacheState>
  transactionsCache: Map<string, AddressTransactionCacheState>
  updateTransactionsCache: Map<string, UpdateTransactionCacheState>
}

interface UpdateTransactionCacheState {
  processing: boolean
}
interface CommonCacheState {
  processing: boolean
  path: ShortPath
}
interface ProcessedUtxoCacheState extends CommonCacheState {
  processing: boolean
  full: boolean
  utxos: Set<IUTXO>
  path: ShortPath
}
interface RawUtxoCacheState extends CommonCacheState {
  address: Required<IAddress>
  requiredCount: number
}
interface AddressTransactionCacheState extends CommonCacheState {
  page: number
  networkQueryVal: number
}

const reconnect = (args: CommonArgs): void => {
  let { reconnectCounter } = args
  if (args.engineStarted) {
    if (reconnectCounter < 5) reconnectCounter++
    args.reconnectTimer = setTimeout(() => {
      clearTimeout(args.reconnectTimer)
      refillServers(args)
    }, args.reconnectCounter * 1000)
  }
}

const refillServers = (args: CommonArgs): void => {
  pushUpdate({
    id: args.walletInfo.id,
    updateFunc: () => {
      doRefillServers(args)
    }
  })
}

const doRefillServers = (args: CommonArgs): void => {
  const {
    pluginState,
    connections,
    emitter,
    walletInfo,
    log,
    serverStates
  } = args
  const includePatterns = ['wss:']
  if (args.serverList.length === 0) {
    args.serverList = pluginState.getServers(NEW_CONNECTIONS, includePatterns)
  }
  log(`refillServers: Top ${NEW_CONNECTIONS} servers:`, args.serverList)
  let chanceToBePicked = 1.25
  while (connections.size < MAX_CONNECTIONS) {
    if (args.serverList.length === 0) break
    const uri = args.serverList.shift()
    if (uri == null) {
      reconnect(args)
      break
    }
    if (connections.get(uri) != null) {
      continue
    }
    // Validate the URI of server to make sure it is valid
    const parsed = parse(uri)
    if (
      parsed.scheme == null ||
      parsed.scheme.length < 3 ||
      parsed.host == null
    ) {
      continue
    }
    chanceToBePicked -= chanceToBePicked > 0.5 ? 0.25 : 0
    if (Math.random() > chanceToBePicked) {
      args.serverList.push(uri)
      continue
    }
    const shortUrl = `${uri.replace('wss://', '').replace('/websocket', '')}:`

    emitter.on(EngineEvent.CONNECTION_OPEN, () => {
      args.reconnectCounter = 0
      log(`${shortUrl} ** Connected **`)
    })
    emitter.on(EngineEvent.CONNECTION_CLOSE, (error?: Error) => {
      connections.delete(uri)
      serverStates.delete(uri)
      const msg =
        error != null ? ` !! Connection ERROR !! ${error.message}` : ''
      log(`${shortUrl} onClose ${msg}`)
      if (error != null) {
        pluginState.serverScoreDown(uri)
      }
      reconnect(args)
    })
    emitter.on(EngineEvent.CONNECTION_TIMER, (queryDate: number) => {
      const queryTime = Date.now() - queryDate
      log(`${shortUrl} returned version in ${queryTime}ms`)
      pluginState.serverScoreUp(uri, queryTime)
    })
    emitter.on(EngineEvent.BLOCK_HEIGHT_CHANGED, (height: number) => {
      log(`${shortUrl} returned height: ${height}`)
      const serverState = serverStates.get(uri)
      if (serverState == null) {
        serverStates.set(uri, {
          subscribedBlocks: true,
          txids: new Set(),
          addresses: new Set()
        })
      } else if (!serverState.subscribedBlocks) {
        serverState.subscribedBlocks = true
      }
    })

    serverStates.set(uri, {
      subscribedBlocks: false,
      txids: new Set(),
      addresses: new Set()
    })

    const onQueueSpaceCB = async (): Promise<
      WsTask<any> | boolean | undefined
    > => {
      const blockBook = connections.get(uri)
      if (blockBook == null) {
        return
      }
      const task = await pickNextTask({ ...args, blockBook, uri })
      if (task != null && typeof task !== 'boolean') {
        const taskMessage = `${task.method} params: ${JSON.stringify(
          task.params
        )}`
        log(`${shortUrl} nextTask: ${taskMessage}`)
      }
      return task
    }

    connections.set(
      uri,
      makeBlockBook({
        wsAddress: uri,
        emitter,
        log,
        onQueueSpaceCB,
        walletId: walletInfo.id
      })
    )

    const blockBook = connections.get(uri)
    if (blockBook == null) continue
    blockBook
      .connect()
      .then(async () => {
        const queryTime = Date.now()
        const { bestHeight } = await blockBook.fetchInfo()
        pluginState.serverScoreUp(uri, Date.now() - queryTime)
        emitter.emit(EngineEvent.BLOCK_HEIGHT_CHANGED, bestHeight)
      })
      .catch(e => {
        log.error(`${JSON.stringify(e.message)}`)
      })
  }
}

const onNewBlock = async (args: CommonArgs): Promise<void> => {
  const { processor, taskCache } = args

  const txIds = await processor.fetchTxIdsByBlockHeight(0)
  if (txIds === []) {
    return
  }
  for (const txId of txIds) {
    taskCache.updateTransactionsCache.set(txId, { processing: false })
  }
}

interface FormatArgs extends CommonArgs, ShortPath {}

interface SetLookAheadArgs extends FormatArgs {}

const setLookAhead = async (args: SetLookAheadArgs): Promise<void> => {
  const { format, branch, currencyInfo, walletTools, processor, mutexor } = args

  await mutexor(`setLookAhead-${format}-${branch}`).runExclusive(async () => {
    const partialPath: Omit<AddressPath, 'addressIndex'> = {
      format,
      changeIndex: branch
    }

    const getLastUsed = async (): Promise<number> =>
      await findLastUsedIndex({ ...args, ...partialPath })
    const getAddressCount = (): number =>
      processor.getNumAddressesFromPathPartition(partialPath)

    let lastUsed = await getLastUsed()
    let addressCount = getAddressCount()
    while (lastUsed + currencyInfo.gapLimit > addressCount) {
      const path: AddressPath = {
        ...partialPath,
        addressIndex: addressCount
      }
      const { address } = walletTools.getAddress(path)
      const scriptPubkey = walletTools.addressToScriptPubkey(address)
      await saveAddress({
        ...args,
        scriptPubkey,
        path
      })
      addToAddressSubscribeCache(args, address, { format, branch })

      lastUsed = await getLastUsed()
      addressCount = getAddressCount()
    }
  })
}

const addToAddressSubscribeCache = (
  args: CommonArgs,
  address: string,
  path: ShortPath
): void => {
  args.taskCache.addressSubscribeCache.set(address, {
    path,
    processing: false
  })
  args.taskCache.addressWatching = false
}

const addToTransactionCache = async (
  args: CommonArgs,
  address: string,
  format: CurrencyFormat,
  branch: number,
  transactions: Map<string, AddressTransactionCacheState>
): Promise<void> => {
  const { walletTools, processor } = args
  // Fetch the networkQueryVal from the database
  const scriptPubkey = walletTools.addressToScriptPubkey(address)
  const { networkQueryVal = 0 } =
    (await processor.fetchAddressByScriptPubkey(scriptPubkey)) ?? {}
  transactions.set(address, {
    processing: false,
    path: {
      format,
      branch
    },
    page: 1, // Page starts on 1
    networkQueryVal
  })
}

interface NextTaskArgs extends CommonArgs {
  blockBook: BlockBook
  uri: string
}

export const pickNextTask = async (
  args: NextTaskArgs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<WsTask<any> | undefined | boolean> => {
  const { taskCache, blockBook, pluginState, uri, serverStates, log } = args

  const {
    addressSubscribeCache,
    utxosCache,
    rawUtxosCache,
    processedUtxosCache,
    transactionsCache,
    updateTransactionsCache
  } = taskCache

  const serverState = serverStates.get(uri)
  if (serverState == null) return

  const serverCanGetTx = (txid: string): boolean => {
    if (serverState.txids.has(txid)) return true

    for (const state of serverStates.values()) {
      if (state.txids.has(txid)) return false
    }
    return true
  }

  const serverCanGetAddress = (address: string): boolean => {
    if (serverState.addresses.has(address)) return true

    for (const state of serverStates.values()) {
      if (state.addresses.has(address)) return false
    }
    return true
  }

  // Loop unparsed utxos, some require a network call to get the full tx data
  for (const [utxo, state] of rawUtxosCache) {
    if (!state.processing) {
      // check if we need to fetch additional network content for legacy purpose type
      const purposeType = currencyFormatToPurposeType(state.path.format)
      if (
        purposeType === BIP43PurposeTypeEnum.Airbitz ||
        purposeType === BIP43PurposeTypeEnum.Legacy
      ) {
        // if we do need to make a network call, check with the serverState
        if (!serverCanGetTx(utxo.txid)) return
      }
      state.processing = true
      rawUtxosCache.delete(utxo)
      const wsTask = await processRawUtxo({
        ...args,
        ...state,
        ...state.path,
        address: state.address,
        utxo,
        id: `${utxo.txid}_${utxo.vout}`
      })
      return wsTask
    }
  }

  // Loop processed utxos, these are just database ops, triggers setLookAhead
  if (processedUtxosCache.size > 0) {
    for (const [address, state] of processedUtxosCache) {
      // Only process when all utxos for a specific address have been gathered
      if (!state.processing && state.full) {
        state.processing = true
        await processUtxoTransactions({
          ...args,
          address,
          utxos: state.utxos,
          path: state.path
        })
        processedUtxosCache.delete(address)
      }
    }
    return true
  }

  // Loop to process addresses to utxos
  for (const [address, state] of utxosCache) {
    // Check if we need to fetch address UTXOs
    if (!state.processing && serverCanGetAddress(address)) {
      state.processing = true

      utxosCache.delete(address)

      // Fetch and process address UTXOs
      const wsTask = await processAddressUtxos({
        ...args,
        ...state,
        address
      })
      wsTask.deferred.promise
        .then(() => {
          serverState.addresses.add(address)
        })
        .catch(e => {
          throw e
        })
      return wsTask
    }
  }

  // Check if there are any addresses pending to be subscribed
  if (addressSubscribeCache.size > 0 && !taskCache.addressWatching) {
    // Loop each address that needs to be subscribed
    for (const [address, state] of addressSubscribeCache) {
      // Add address in the cache to the set of addresses to watch
      const { path, processing: subscribed } = state
      // only process newly watched addresses
      if (subscribed) continue
      if (path != null) {
        // Add the newly watched addresses to the UTXO cache
        utxosCache.set(address, {
          processing: false,
          path
        })
        await addToTransactionCache(
          args,
          address,
          path.format,
          path.branch,
          transactionsCache
        )
      }
      state.processing = true
    }

    taskCache.addressWatching = true

    const queryTime = Date.now()
    const deferredAddressSub = new Deferred<unknown>()
    deferredAddressSub.promise
      .then(() => {
        pluginState.serverScoreUp(uri, Date.now() - queryTime)
      })
      .catch(() => {
        taskCache.addressWatching = false
      })
    deferredAddressSub.promise.catch(() => {
      taskCache.addressWatching = false
    })
    blockBook.watchAddresses(
      Array.from(addressSubscribeCache.keys()),
      (response: INewTransactionResponse) => {
        serverState.txids.add(response.tx.txid)
        const state = addressSubscribeCache.get(response.address)
        if (state != null) {
          const { path } = state
          utxosCache.set(response.address, {
            processing: false,
            path
          })
          addToTransactionCache(
            args,
            response.address,
            path.format,
            path.branch,
            transactionsCache
          ).catch(() => {
            throw new Error('failed to add to transaction cache')
          })
          setLookAhead({ ...args, ...path }).catch(e => {
            log(e)
          })
        }
      },
      deferredAddressSub
    )
    return true
  }

  // subscribe all servers to new blocks
  if (!serverState.subscribedBlocks) {
    serverState.subscribedBlocks = true
    const queryTime = Date.now()
    const deferredBlockSub = new Deferred<unknown>()
    deferredBlockSub.promise
      .then(() => {
        pluginState.serverScoreUp(uri, Date.now() - queryTime)
      })
      .catch(() => {
        serverState.subscribedBlocks = false
      })
    blockBook.watchBlocks(
      async () => await onNewBlock({ ...args }),
      deferredBlockSub
    )
    return true
  }

  // filled when transactions potentially changed (e.g. through new block notification)
  if (updateTransactionsCache.size > 0) {
    for (const [txId, state] of updateTransactionsCache) {
      if (!state.processing && serverCanGetTx(txId)) {
        state.processing = true
        updateTransactionsCache.delete(txId)
        const updateTransactionTask = updateTransactions({ ...args, txId })
        // once resolved, add the txid to the server cache
        updateTransactionTask.deferred.promise
          .then(() => {
            serverState.txids.add(txId)
          })
          .catch(e => {
            throw e
          })
        return updateTransactionTask
      }
    }
    return true
  }

  // loop to get and process transaction history of single addresses, triggers setLookAhead
  for (const [address, state] of transactionsCache) {
    if (!state.processing && serverCanGetAddress(address)) {
      state.processing = true

      transactionsCache.delete(address)

      // Fetch and process address UTXOs
      const wsTask = await processAddressTransactions({
        ...args,
        ...state,
        address
      })
      wsTask.deferred.promise
        .then(() => {
          serverState.addresses.add(address)
        })
        .catch(e => {
          throw e
        })
      return wsTask
    }
  }
}

interface UpdateTransactionsArgs extends CommonArgs {
  txId: string
}

const updateTransactions = (
  args: UpdateTransactionsArgs
): WsTask<ITransaction> => {
  const { txId, processor, taskCache } = args
  const deferredITransaction = new Deferred<ITransaction>()
  deferredITransaction.promise
    .then(async (rawTx: ITransaction) => {
      const tx = processRawTx({ ...args, tx: rawTx })
      // check if tx is still not confirmed, if so, don't change anything
      if (tx.blockHeight < 1) {
        return
      }
      await processor.removeTxIdByBlockHeight(0, txId)
      await processor.insertTxIdByBlockHeight(tx.blockHeight, txId)
      await processor.updateTransaction(txId, tx)
    })
    .catch(() => {
      taskCache.updateTransactionsCache.set(txId, { processing: false })
    })
  return {
    ...transactionMessage(txId),
    deferred: deferredITransaction
  }
}

interface SaveAddressArgs extends CommonArgs {
  scriptPubkey: string
  path?: AddressPath
  used?: boolean
}

const saveAddress = async (args: SaveAddressArgs): Promise<void> => {
  const { scriptPubkey, path, used = false, processor, mutexor } = args

  await mutexor('saveAddress').runExclusive(async () => {
    try {
      await processor.saveAddress({
        scriptPubkey,
        path,
        used,
        networkQueryVal: 0,
        lastQuery: 0,
        lastTouched: 0,
        balance: '0'
      })
    } catch (err) {
      if (err.message === 'Address already exists.') {
        await processor.updateAddressByScriptPubkey(scriptPubkey, {
          path,
          used
        })
      } else {
        throw err
      }
    }
  })
}

interface GetTotalAddressCountArgs {
  currencyInfo: EngineCurrencyInfo
  walletInfo: EdgeWalletInfo
  processor: Processor
}

const getTotalAddressCount = async (
  args: GetTotalAddressCountArgs
): Promise<number> => {
  const { walletInfo } = args

  const walletFormats = getWalletSupportedFormats(walletInfo)

  let count = 0
  for (const format of walletFormats) {
    count += await getFormatAddressCount({ ...args, format })
  }
  return count
}

interface GetFormatAddressCountArgs extends GetTotalAddressCountArgs {
  format: CurrencyFormat
}

const getFormatAddressCount = async (
  args: GetFormatAddressCountArgs
): Promise<number> => {
  const { format, currencyInfo, processor } = args

  let count = 0

  const branches = getFormatSupportedBranches(format)
  for (const branch of branches) {
    let branchCount = await processor.getNumAddressesFromPathPartition({
      format,
      changeIndex: branch
    })
    if (branchCount < currencyInfo.gapLimit) branchCount = currencyInfo.gapLimit
    count += branchCount
  }

  return count
}

interface FindLastUsedIndexArgs extends FormatArgs {}

/**
 * Assumes the last used index is:
 *    addressCount - gapLimit - 1
 * Verified by checking the ~used~ flag on the address and then checking newer ones.
 * @param args - FindLastUsedIndexArgs
 */
const findLastUsedIndex = async (
  args: FindLastUsedIndexArgs
): Promise<number> => {
  const { format, branch, currencyInfo, processor } = args

  const partialPath: Omit<AddressPath, 'addressIndex'> = {
    format,
    changeIndex: branch
  }
  const addressCount = await processor.getNumAddressesFromPathPartition(
    partialPath
  )
  // Start 1 index behind the assumed last used index
  let lastUsedIndex = Math.max(addressCount - currencyInfo.gapLimit - 1, 0)

  for (let i = lastUsedIndex; i < addressCount; i++) {
    const { used } = await fetchAddressDataByPath({
      ...args,
      path: {
        ...partialPath,
        addressIndex: i
      }
    })

    if (used) {
      lastUsedIndex = i
    }
  }

  return lastUsedIndex
}

interface FetchAddressDataByPath extends CommonArgs {
  path: AddressPath
}

const fetchAddressDataByPath = async (
  args: FetchAddressDataByPath
): Promise<IAddress> => {
  const { path, processor, walletTools } = args

  const scriptPubkey =
    (await processor.fetchScriptPubkeyByPath(path)) ??
    walletTools.getScriptPubkey(path).scriptPubkey

  const addressData = await processor.fetchAddressByScriptPubkey(scriptPubkey)
  if (addressData == null) throw new Error('Address data unknown')
  return addressData
}

interface GetFreshAddressArgs extends FormatArgs {}

interface GetFreshAddressReturn {
  address: string
  legacyAddress: string
}

const internalGetFreshAddress = async (
  args: GetFreshAddressArgs
): Promise<GetFreshAddressReturn> => {
  const { format, branch, walletTools, processor } = args

  const path: AddressPath = {
    format,
    changeIndex: branch,
    addressIndex: (await findLastUsedIndex(args)) + 1
  }
  const scriptPubkey =
    (await processor.fetchScriptPubkeyByPath(path)) ??
    (await walletTools.getScriptPubkey(path)).scriptPubkey
  if (scriptPubkey == null) {
    throw new Error('Unknown address path')
  }
  return walletTools.scriptPubkeyToAddress({
    scriptPubkey,
    format
  })
}

interface ProcessAddressTxsArgs
  extends AddressTransactionCacheState,
    CommonArgs {
  address: string
  uri: string
}

type addressResponse = IAccountDetailsBasic &
  ITransactionDetailsPaginationResponse

const processAddressTransactions = async (
  args: ProcessAddressTxsArgs
): Promise<WsTask<addressResponse>> => {
  const {
    address,
    page = 1,
    networkQueryVal,
    processor,
    walletTools,
    path,
    taskCache,
    pluginState,
    uri
  } = args
  const transactionsCache = taskCache.transactionsCache

  const scriptPubkey = walletTools.addressToScriptPubkey(address)
  const addressData = await processor.fetchAddressByScriptPubkey(scriptPubkey)
  if (addressData == null) {
    throw new Error(`could not find address with script pubkey ${scriptPubkey}`)
  }

  const queryTime = Date.now()
  const deferredAddressResponse = new Deferred<addressResponse>()
  deferredAddressResponse.promise
    .then(async (value: addressResponse) => {
      pluginState.serverScoreUp(uri, Date.now() - queryTime)
      const { transactions = [], txs, unconfirmedTxs, totalPages } = value

      // If address is used and previously not marked as used, mark as used.
      const used = txs > 0 || unconfirmedTxs > 0
      if (used && !(addressData.used ?? false) && page === 1) {
        await processor.updateAddressByScriptPubkey(scriptPubkey, {
          used
        })
        await setLookAhead({ ...args, ...path })
      }

      for (const rawTx of transactions) {
        const tx = processRawTx({ ...args, tx: rawTx })
        await processor.saveTransaction(tx)
      }

      if (page < totalPages) {
        // Add the address back to the cache, incrementing the page
        transactionsCache.set(address, {
          path,
          networkQueryVal,
          processing: false,
          page: page + 1
        })
      } else {
        // Callback for when an address has been fully processed
        args.onAddressChecked()

        await setLookAhead({ ...args, ...path })
      }
    })
    .catch(() => {
      args.processing = false
      transactionsCache.set(address, {
        path,
        networkQueryVal,
        processing: args.processing,
        page
      })
    })
  return {
    ...addressMessage(address, {
      details: 'txs',
      from: networkQueryVal,
      perPage: BLOCKBOOK_TXS_PER_PAGE,
      page
    }),
    deferred: deferredAddressResponse
  }
}

interface ProcessRawTxArgs extends CommonArgs {
  tx: ITransaction
}

const processRawTx = (args: ProcessRawTxArgs): IProcessorTransaction => {
  const { tx, currencyInfo } = args
  return {
    txid: tx.txid,
    hex: tx.hex,
    // Blockbook can return a blockHeight of -1 when the tx is pending in the mempool
    blockHeight: tx.blockHeight > 0 ? tx.blockHeight : 0,
    date: tx.blockTime,
    fees: tx.fees,
    inputs: tx.vin.map(input => ({
      txId: input.txid,
      outputIndex: input.vout, // case for tx `fefac8c22ba1178df5d7c90b78cc1c203d1a9f5f5506f7b8f6f469fa821c2674` no `vout` for input
      scriptPubkey: validScriptPubkeyFromAddress({
        address: input.addresses[0],
        coin: currencyInfo.network,
        network: args.network
      }),
      amount: input.value
    })),
    outputs: tx.vout.map(output => ({
      index: output.n,
      scriptPubkey:
        output.hex ??
        validScriptPubkeyFromAddress({
          address: output.addresses[0],
          coin: currencyInfo.network,
          network: args.network
        }),
      amount: output.value
    })),
    ourIns: [],
    ourOuts: [],
    ourAmount: '0'
  }
}

interface ProcessAddressUtxosArgs extends CommonCacheState, CommonArgs {
  address: string
  uri: string
}

const processAddressUtxos = async (
  args: ProcessAddressUtxosArgs
): Promise<WsTask<IAccountUTXO[]>> => {
  const {
    address,
    walletTools,
    processor,
    taskCache,
    path,
    pluginState,
    uri,
    mutexor
  } = args
  const { utxosCache, rawUtxosCache } = taskCache
  const queryTime = Date.now()
  const deferredIAccountUTXOs = new Deferred<IAccountUTXO[]>()
  deferredIAccountUTXOs.promise
    .then(async (utxos: IAccountUTXO[]) => {
      pluginState.serverScoreUp(uri, Date.now() - queryTime)
      const scriptPubkey = walletTools.addressToScriptPubkey(address)
      await mutexor(`utxos-${scriptPubkey}`).runExclusive(async () => {
        const addressData = await processor.fetchAddressByScriptPubkey(
          scriptPubkey
        )
        if (addressData == null || addressData.path == null) {
          return
        }
        for (const utxo of utxos) {
          rawUtxosCache.set(utxo, {
            processing: false,
            requiredCount: utxos.length,
            path,
            // TypeScript yells otherwise
            address: { ...addressData, path: addressData.path }
          })
        }
      })
    })
    .catch(() => {
      args.processing = false
      utxosCache.set(address, {
        processing: args.processing,
        path
      })
    })
  return {
    ...addressUtxosMessage(address),
    deferred: deferredIAccountUTXOs
  }
}

interface ProcessUtxoTransactionArgs extends CommonArgs {
  address: IAddress
  utxos: Set<IUTXO>
  path: ShortPath
}

const processUtxoTransactions = async (
  args: ProcessUtxoTransactionArgs
): Promise<void> => {
  const {
    address,
    utxos,
    currencyInfo,
    processor,
    emitter,
    mutexor,
    log
  } = args

  await mutexor(`utxos-transactions-${address.scriptPubkey}`).runExclusive(
    async () => {
      let newBalance = '0'
      let oldBalance = '0'
      const currentUtxos = await processor.fetchUtxosByScriptPubkey(
        address.scriptPubkey
      )
      const currentUtxoIds = new Set(
        currentUtxos.map(({ id, value }) => {
          oldBalance = bs.add(oldBalance, value)
          return id
        })
      )

      const toAdd = new Set<IUTXO>()
      for (const utxo of utxos) {
        if (currentUtxoIds.has(utxo.id)) {
          currentUtxoIds.delete(utxo.id)
        } else {
          toAdd.add(utxo)
        }
      }

      for (const utxo of toAdd) {
        await processor.saveUtxo(utxo)
        newBalance = bs.add(newBalance, utxo.value)
      }
      for (const id of currentUtxoIds) {
        const utxo = await processor.removeUtxo(id)
        newBalance = bs.sub(newBalance, utxo.value)
      }

      const diff = bs.sub(newBalance, oldBalance)
      if (diff !== '0') {
        log({ address, diff })
        emitter.emit(
          EngineEvent.ADDRESS_BALANCE_CHANGED,
          currencyInfo.currencyCode,
          diff
        )

        await processor.updateAddressByScriptPubkey(address.scriptPubkey, {
          balance: newBalance,
          used: true
        })
        await setLookAhead({ ...args, ...args.path })
      }
    }
  )
}

interface ProcessRawUtxoArgs extends FormatArgs, RawUtxoCacheState {
  utxo: IAccountUTXO
  id: string
  address: Required<IAddress>
  uri: string
}

const processRawUtxo = async (
  args: ProcessRawUtxoArgs
): Promise<WsTask<ITransaction> | undefined> => {
  const {
    utxo,
    id,
    address,
    format,
    walletTools,
    processor,
    path,
    taskCache,
    requiredCount,
    pluginState,
    uri
  } = args
  const { rawUtxosCache, processedUtxosCache } = taskCache
  let scriptType: ScriptTypeEnum
  let script: string
  let redeemScript: string | undefined

  let tx: IProcessorTransaction | undefined
  switch (currencyFormatToPurposeType(format)) {
    case BIP43PurposeTypeEnum.Airbitz:
    case BIP43PurposeTypeEnum.Legacy:
      scriptType = ScriptTypeEnum.p2pkh

      // Legacy UTXOs need the previous transaction hex as the script
      // If we do not currently have it, add it to the queue to fetch it
      tx = await processor.fetchTransaction(utxo.txid)
      if (tx == null) {
        const queryTime = Date.now()
        const deferredITransaction = new Deferred<ITransaction>()
        deferredITransaction.promise
          .then((rawTx: ITransaction) => {
            pluginState.serverScoreUp(uri, Date.now() - queryTime)
            const processedTx = processRawTx({ ...args, tx: rawTx })
            script = processedTx.hex
            // Only after we have successfully fetched the tx, set our script and call done
            done()
          })
          .catch(() => {
            // If something went wrong, add the UTXO back to the queue
            rawUtxosCache.set(utxo, {
              processing: false,
              path,
              address,
              requiredCount
            })
          })
        return {
          ...transactionMessage(utxo.txid),
          deferred: deferredITransaction
        }
      } else {
        script = tx.hex
      }

      break
    case BIP43PurposeTypeEnum.WrappedSegwit:
      scriptType = ScriptTypeEnum.p2wpkhp2sh
      script = address.scriptPubkey
      redeemScript = walletTools.getScriptPubkey(address.path).redeemScript

      break
    case BIP43PurposeTypeEnum.Segwit:
      scriptType = ScriptTypeEnum.p2wpkh
      script = address.scriptPubkey

      break
  }

  // Function to call once we are finished
  const done = (): void =>
    addToProcessedUtxosCache(
      processedUtxosCache,
      path,
      address,
      requiredCount,
      {
        id,
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        scriptPubkey: address.scriptPubkey,
        script,
        redeemScript,
        scriptType,
        blockHeight: utxo.height ?? 0
      }
    )

  // Since we have everything, call done
  done()
}

const addToProcessedUtxosCache = (
  processedUtxosCache: Map<IAddress, ProcessedUtxoCacheState>,
  path: ShortPath,
  address: IAddress,
  requiredCount: number,
  utxo: IUTXO
): void => {
  const processedUtxos: ProcessedUtxoCacheState = processedUtxosCache.get(
    address
  ) ?? {
    utxos: new Set(),
    processing: false,
    path,
    full: false
  }
  processedUtxos.utxos.add(utxo)
  processedUtxos.full = processedUtxos.utxos.size >= requiredCount
  processedUtxosCache.set(address, processedUtxos)
}
