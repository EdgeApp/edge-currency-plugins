import { add, sub } from 'biggystring'
import {
  EdgeFreshAddress,
  EdgeIo,
  EdgeLog,
  EdgeTransaction
} from 'edge-core-js/types'

import { EngineEmitter, EngineEvent } from '../../plugin/makeEngineEmitter'
import {
  AddressPath,
  ChangePath,
  CurrencyFormat,
  EngineConfig,
  EngineInfo,
  PluginInfo
} from '../../plugin/types'
import { removeItem } from '../../plugin/utils'
import { Processor } from '../db/makeProcessor'
import { toEdgeTransaction } from '../db/Models/ProcessorTransaction'
import {
  IAddress,
  IProcessorTransaction,
  IUTXO,
  makeIAddress
} from '../db/types'
import { NumbWalletInfo } from '../keymanager/cleaners'
import {
  BIP43PurposeTypeEnum,
  derivationLevelScriptHash,
  ScriptTypeEnum
} from '../keymanager/keymanager'
import {
  addressMessage,
  AddressResponse,
  addressUtxosMessage,
  AddressUtxosResponse,
  BlockbookAccountUtxo,
  SubscribeAddressResponse,
  transactionMessage,
  TransactionResponse
} from '../network/BlockBookAPI'
import Deferred from '../network/Deferred'
import { WsTask } from '../network/Socket'
import AwaitLock from './await-lock'
import { BLOCKBOOK_TXS_PER_PAGE, CACHE_THROTTLE } from './constants'
import { makeServerStates, ServerStates } from './makeServerStates'
import { UTXOPluginWalletTools } from './makeUtxoWalletTools'
import {
  currencyFormatToPurposeType,
  getCurrencyFormatFromPurposeType,
  getFormatSupportedBranches,
  validScriptPubkeyFromAddress
} from './utils'

export interface UtxoEngineState {
  processedPercent: number

  start: () => Promise<void>

  stop: () => Promise<void>

  deriveScriptAddress: (script: string) => Promise<EdgeFreshAddress>

  getFreshAddress: (branch?: number) => Promise<EdgeFreshAddress>

  addGapLimitAddresses: (addresses: string[]) => Promise<void>

  broadcastTx: (transaction: EdgeTransaction) => Promise<string>

  refillServers: () => void

  getServerList: () => string[]

  setServerList: (serverList: string[]) => void

  loadWifs: (wifs: string[]) => Promise<void>
}

export interface UtxoEngineStateConfig extends EngineConfig {
  walletTools: UTXOPluginWalletTools
  walletInfo: NumbWalletInfo
  processor: Processor
}

export function makeUtxoEngineState(
  config: UtxoEngineStateConfig
): UtxoEngineState {
  const {
    pluginInfo,
    walletInfo,
    walletTools,
    options: { emitter, log },
    processor,
    pluginState
  } = config

  const { walletFormats } = walletInfo.keys

  const taskCache: TaskCache = {
    addressWatching: false,
    blockWatching: false,
    addressSubscribeCache: {},
    addressTransactionCache: {},
    addressUtxoCache: {},
    rawUtxoCache: {},
    processorUtxoCache: {},
    updateTransactionCache: {}
  }

  const clearTaskCache = (): void => {
    taskCache.addressWatching = false
    taskCache.blockWatching = false
    taskCache.addressSubscribeCache = {}
    taskCache.addressTransactionCache = {}
    taskCache.addressUtxoCache = {}
    taskCache.rawUtxoCache = {}
    taskCache.processorUtxoCache = {}
    taskCache.updateTransactionCache = {}
  }

  /**
   * There are two processes that need to complete per address:
   * 1. Address transaction processing
   * 2. Address UTXO processing
   **/
  const processesPerAddress = 2
  let processedCount = 0
  let processedPercent = 0
  const updateProgressRatio = async (): Promise<void> => {
    // We expect the total number of progress updates to equal the number of
    // addresses multiplied the number of processes per address.
    const expectedProccessCount =
      Object.keys(taskCache.addressSubscribeCache).length * processesPerAddress

    // Increment the processed count
    processedCount = processedCount + 1

    // If we have no addresses, we should not have not yet began processing.
    if (expectedProccessCount === 0) throw new Error('No addresses to process')

    const percent = processedCount / expectedProccessCount
    if (percent - processedPercent > CACHE_THROTTLE || percent === 1) {
      log(
        `processed changed, percent: ${percent}, processedCount: ${processedCount}, totalCount: ${expectedProccessCount}`
      )
      processedPercent = percent
      emitter.emit(EngineEvent.ADDRESSES_CHECKED, percent)
    }
  }

  const lock = new AwaitLock()

  const serverStates = makeServerStates({
    engineEmitter: emitter,
    log,
    pluginInfo,
    pluginState,
    walletInfo
  })
  const commonArgs: CommonArgs = {
    pluginInfo,
    walletInfo,
    walletTools,
    processor,
    emitter,
    taskCache,
    updateProgressRatio,
    io: config.io,
    log,
    serverStates,
    walletFormats,
    lock
  }

  const pickNextTaskCB = async (
    uri: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<boolean | WsTask<any> | undefined> => {
    return await pickNextTask({ ...commonArgs, uri })
  }

  serverStates.setPickNextTaskCB(pickNextTaskCB)

  let running = false
  const run = async (): Promise<void> => {
    if (running) return
    running = true

    await initializeAddressSubscriptions()
    await setLookAhead(commonArgs)
  }

  emitter.on(
    EngineEvent.BLOCK_HEIGHT_CHANGED,
    async (_uri: string, _blockHeight: number): Promise<void> => {
      const txs = await processor.fetchTransactions({
        blockHeight: 0
      })
      for (const tx of txs) {
        if (tx == null) continue
        taskCache.updateTransactionCache[tx.txid] = { processing: false }
      }
    }
  )

  emitter.on(
    EngineEvent.NEW_ADDRESS_TRANSACTION,
    async (_uri: string, response: SubscribeAddressResponse): Promise<void> => {
      const state = taskCache.addressSubscribeCache[response.address]
      if (state != null) {
        const { path } = state
        taskCache.addressUtxoCache[response.address] = {
          processing: false,
          path
        }
        addToAddressTransactionCache(
          commonArgs,
          response.address,
          path.format,
          path.changeIndex,
          0,
          taskCache.addressTransactionCache
        ).catch(() => {
          throw new Error('failed to add to transaction cache')
        })
        setLookAhead(commonArgs).catch(e => {
          log(e)
        })
      }
    }
  )

  // Initialize the addressSubscribeCache with the existing addresses already
  // processed by the processor. This happens only once before any call to
  // setLookAhead.
  const initializeAddressSubscriptions = async (): Promise<void> => {
    for (const format of walletFormats) {
      const branches = getFormatSupportedBranches(format)
      for (const branch of branches) {
        const addressesToSubscribe = new Set<string>()
        const branchAddressCount = processor.numAddressesByFormatPath({
          format,
          changeIndex: branch
        })
        // If the processor has not processed any addresses then the loop
        // condition will only iterate once when branchAddressCount is 0 for the
        // first address in the derivation path.
        for (
          let addressIndex = 0;
          addressIndex < branchAddressCount;
          addressIndex++
        ) {
          const processorAddress = await processor.fetchAddress({
            format,
            changeIndex: branch,
            addressIndex
          })
          if (processorAddress == null) {
            throw new Error(
              'Missing processor during address subscription initialization'
            )
          }
          const { address } = walletTools.scriptPubkeyToAddress({
            scriptPubkey: processorAddress.scriptPubkey,
            format
          })
          addressesToSubscribe.add(address)
        }
        addToAddressSubscribeCache(commonArgs.taskCache, addressesToSubscribe, {
          format,
          changeIndex: branch
        })
      }
    }
  }

  return {
    processedPercent,
    async start(): Promise<void> {
      processedCount = 0
      processedPercent = 0

      await run()
      serverStates.refillServers()
    },

    async stop(): Promise<void> {
      serverStates.stop()
      clearTaskCache()
      running = false
    },

    async getFreshAddress(branch = 0): Promise<EdgeFreshAddress> {
      const walletPurpose = currencyFormatToPurposeType(
        walletInfo.keys.primaryFormat
      )
      if (walletPurpose === BIP43PurposeTypeEnum.Segwit) {
        const { address: publicAddress } = await internalGetFreshAddress({
          ...commonArgs,
          format: getCurrencyFormatFromPurposeType(
            BIP43PurposeTypeEnum.WrappedSegwit
          ),
          changeIndex: branch
        })

        const { address: segwitAddress } = await internalGetFreshAddress({
          ...commonArgs,
          format: getCurrencyFormatFromPurposeType(BIP43PurposeTypeEnum.Segwit),
          changeIndex: branch
        })

        return {
          publicAddress,
          segwitAddress
        }
      } else {
        // Airbitz wallets only use branch 0
        if (walletPurpose === BIP43PurposeTypeEnum.Airbitz) {
          branch = 0
        }

        const {
          address: publicAddress,
          legacyAddress
        } = await internalGetFreshAddress({
          ...commonArgs,
          format: getCurrencyFormatFromPurposeType(walletPurpose),
          changeIndex: branch
        })

        return {
          publicAddress,
          legacyAddress:
            legacyAddress !== publicAddress ? legacyAddress : undefined
        }
      }
    },

    async deriveScriptAddress(script): Promise<EdgeFreshAddress> {
      const { address } = await internalDeriveScriptAddress({
        walletTools: commonArgs.walletTools,
        engineInfo: commonArgs.pluginInfo.engineInfo,
        processor: commonArgs.processor,
        taskCache: commonArgs.taskCache,
        format: walletInfo.keys.primaryFormat,
        script
      })
      return {
        publicAddress: address
      }
    },

    async addGapLimitAddresses(addresses: string[]): Promise<void> {
      const promises = addresses.map(async address => {
        const scriptPubkey = walletTools.addressToScriptPubkey(address)
        await processor.saveAddress(
          makeIAddress({
            scriptPubkey,
            used: true
          })
        )
      })
      await Promise.all(promises)
      await run()
    },

    async broadcastTx(transaction: EdgeTransaction): Promise<string> {
      /*
      The code below appears to be left-over implementation for RBF, however the
      UTXO `spent` property has no effect within the current implementation and
      the UTXOs are eventually removed once the transaction is broadcast and the
      engine syncs with the network.

      TODO: Figure out whether this code is still needed.
      */
      // put spent utxos into an interim data structure (saveSpentUtxo)
      // these utxos are removed once the transaction confirms
      const [tx] = await processor.fetchTransactions({ txId: transaction.txid })
      if (tx != null) {
        for (const inputs of tx.inputs) {
          const [utxo] = await processor.fetchUtxos({
            utxoIds: [`${inputs.txId}_${inputs.outputIndex}`]
          })
          if (utxo != null) {
            utxo.spent = true
            await processor.saveUtxo(utxo)
          }
        }
      }
      const txId = await serverStates.broadcastTx(transaction)
      return txId
    },
    refillServers(): void {
      serverStates.refillServers()
    },
    getServerList(): string[] {
      return serverStates.getServerList()
    },
    setServerList(serverList: string[]) {
      serverStates.setServerList(serverList)
    },

    async loadWifs(wifs: string[]) {
      for (const wif of wifs) {
        for (const format of walletFormats) {
          const changePath: ChangePath = {
            format,
            changeIndex: 0
          }
          const path: AddressPath = {
            ...changePath,
            addressIndex: 0
          }
          const {
            scriptPubkey,
            redeemScript
          } = walletTools.getScriptPubkeyFromWif(wif, format)
          const { address } = walletTools.scriptPubkeyToAddress({
            scriptPubkey,
            format: path.format
          })

          // Make a new IAddress and save it
          await processor.saveAddress(
            makeIAddress({ scriptPubkey, redeemScript, path })
          )

          taskCache.addressSubscribeCache[address] = {
            path: changePath,
            processing: false
          }
        }
      }
      taskCache.addressWatching = false
    }
  }
}

interface CommonArgs {
  pluginInfo: PluginInfo
  walletInfo: NumbWalletInfo
  walletTools: UTXOPluginWalletTools
  processor: Processor
  emitter: EngineEmitter
  taskCache: TaskCache
  updateProgressRatio: () => void
  io: EdgeIo
  log: EdgeLog
  serverStates: ServerStates
  walletFormats: CurrencyFormat[]
  lock: AwaitLock
}

interface TaskCache {
  addressWatching: boolean
  blockWatching: boolean
  addressSubscribeCache: AddressSubscribeCache
  addressUtxoCache: AddressUtxoCache
  rawUtxoCache: RawUtxoCache
  processorUtxoCache: ProcessorUtxoCache
  addressTransactionCache: AddressTransactionCache
  updateTransactionCache: UpdateTransactionCache
}

interface UpdateTransactionCache {
  [key: string]: { processing: boolean }
}
interface AddressSubscribeCache {
  [key: string]: { processing: boolean; path: ChangePath }
}
interface AddressUtxoCache {
  [key: string]: { processing: boolean; path: ChangePath }
}
interface ProcessorUtxoCache {
  [key: string]: {
    processing: boolean
    full: boolean
    utxos: Set<IUTXO>
    path: ChangePath
  }
}
interface RawUtxoCache {
  [key: string]: {
    processing: boolean
    path: ChangePath
    address: IAddress
    requiredCount: number
  }
}
interface AddressTransactionCache {
  [key: string]: {
    processing: boolean
    path: ChangePath
    page: number
    blockHeight: number
  }
}

interface FormatArgs extends CommonArgs, ChangePath {}

const setLookAhead = async (common: CommonArgs): Promise<void> => {
  const {
    pluginInfo: { engineInfo },
    lock,
    processor,
    walletFormats,
    walletTools
  } = common

  // Wait for the lock to be released before continuing invocation.
  // This is to ensure that setLockAhead is not called while the lock is held.
  await lock.acquireAsync()

  try {
    for (const format of walletFormats) {
      const branches = getFormatSupportedBranches(format)
      for (const branch of branches) {
        await deriveKeys({ format, changeIndex: branch })
      }
    }
  } finally {
    lock.release()
  }

  async function deriveKeys(changePath: ChangePath): Promise<void> {
    const addressesToSubscribe = new Set<string>()
    const totalAddressCount = processor.numAddressesByFormatPath(changePath)
    let lastUsedIndex = await processor.lastUsedIndexByFormatPath(changePath)

    // Loop until the total address count equals the lookahead count
    let lookAheadIndex = lastUsedIndex + engineInfo.gapLimit
    let nextAddressIndex = totalAddressCount
    while (nextAddressIndex <= lookAheadIndex) {
      const path: AddressPath = {
        ...changePath,
        addressIndex: nextAddressIndex
      }

      const { scriptPubkey, redeemScript } = walletTools.getScriptPubkey(path)
      const { address } = walletTools.scriptPubkeyToAddress({
        scriptPubkey,
        format: path.format
      })

      // Make a new IAddress and save it
      await processor.saveAddress(
        makeIAddress({ scriptPubkey, redeemScript, path })
      )

      // Add the displayAddress to the set of addresses to subscribe to after loop
      addressesToSubscribe.add(address)

      // Update the state for the loop
      lastUsedIndex = await processor.lastUsedIndexByFormatPath(changePath)
      lookAheadIndex = lastUsedIndex + engineInfo.gapLimit
      nextAddressIndex = processor.numAddressesByFormatPath(changePath)
    }

    // Add all the addresses to the subscribe cache for registering subscriptions later
    addToAddressSubscribeCache(
      common.taskCache,
      addressesToSubscribe,
      changePath
    )
  }
}

const addToAddressSubscribeCache = (
  taskCache: TaskCache,
  addresses: Set<string>,
  path: ChangePath
): void => {
  addresses.forEach(address => {
    taskCache.addressSubscribeCache[address] = {
      path,
      processing: false
    }
    taskCache.addressWatching = false
  })
}

const addToAddressTransactionCache = async (
  args: CommonArgs,
  address: string,
  format: CurrencyFormat,
  branch: number,
  blockHeight: number,
  addressTransactionCache: AddressTransactionCache
): Promise<void> => {
  const { walletTools, processor } = args
  // Fetch the blockHeight for the address from the database
  const scriptPubkey = walletTools.addressToScriptPubkey(address)

  if (blockHeight === 0) {
    const { lastQueriedBlockHeight = 0 } =
      (await processor.fetchAddress(scriptPubkey)) ?? {}
    blockHeight = lastQueriedBlockHeight
  }

  addressTransactionCache[address] = {
    processing: false,
    path: {
      format,
      changeIndex: branch
    },
    page: 1, // Page starts on 1
    blockHeight
  }
}

interface TransactionChangedArgs {
  tx: IProcessorTransaction
  emitter: EngineEmitter
  walletTools: UTXOPluginWalletTools
  pluginInfo: PluginInfo
  processor: Processor
}

export const transactionChanged = async (
  args: TransactionChangedArgs
): Promise<void> => {
  const {
    emitter,
    walletTools,
    processor,
    pluginInfo: { currencyInfo, engineInfo },
    tx
  } = args
  emitter.emit(EngineEvent.TRANSACTIONS_CHANGED, [
    await toEdgeTransaction({
      tx,
      currencyCode: currencyInfo.currencyCode,
      walletTools,
      processor,
      engineInfo
    })
  ])
}

interface NextTaskArgs extends CommonArgs {
  uri: string
}

export const pickNextTask = async (
  args: NextTaskArgs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<WsTask<any> | undefined | boolean> => {
  const { taskCache, uri, serverStates } = args

  const {
    addressSubscribeCache,
    addressUtxoCache,
    rawUtxoCache,
    processorUtxoCache,
    addressTransactionCache,
    updateTransactionCache
  } = taskCache

  const serverState = serverStates.getServerState(uri)
  if (serverState == null) return

  // subscribe all servers to new blocks
  if (serverState.blockSubscriptionStatus === 'unsubscribed') {
    serverStates.watchBlocks(uri)
    return true
  }

  // Loop processed utxos, these are just database ops, triggers setLookAhead
  if (Object.keys(processorUtxoCache).length > 0) {
    for (const [scriptPubkey, state] of Object.entries(processorUtxoCache)) {
      // Only process when all utxos for a specific address have been gathered
      if (!state.processing && state.full) {
        state.processing = true
        await processProcessorUtxos({
          ...args,
          scriptPubkey,
          utxos: state.utxos,
          path: state.path
        })
        removeItem(processorUtxoCache, scriptPubkey)
        return true
      }
    }
  }

  // Loop unparsed utxos, some require a network call to get the full tx data
  for (const [utxoString, state] of Object.entries(rawUtxoCache)) {
    const utxo: BlockbookAccountUtxo = JSON.parse(utxoString)
    if (utxo == null) continue
    if (!state.processing) {
      // check if we need to fetch additional network content for legacy purpose type
      const purposeType = currencyFormatToPurposeType(state.path.format)
      if (
        purposeType === BIP43PurposeTypeEnum.Airbitz ||
        purposeType === BIP43PurposeTypeEnum.Legacy
      ) {
        // if we do need to make a network call, check with the serverState
        if (!serverStates.serverCanGetTx(uri, utxo.txid)) return
      }
      state.processing = true
      removeItem(rawUtxoCache, utxoString)
      const wsTask = await processRawUtxo({
        ...args,
        ...state,
        address: state.address,
        utxo,
        id: `${utxo.txid}_${utxo.vout}`
      })
      return wsTask ?? true
    }
  }

  // Loop to process addresses to utxos
  for (const [address, state] of Object.entries(addressUtxoCache)) {
    // Check if we need to fetch address UTXOs
    if (!state.processing && serverStates.serverCanGetAddress(uri, address)) {
      state.processing = true

      removeItem(addressUtxoCache, address)

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
  if (
    Object.keys(addressSubscribeCache).length > 0 &&
    !taskCache.addressWatching
  ) {
    const blockHeight = serverStates.getBlockHeight(uri)
    // Loop each address that needs to be subscribed
    for (const [address, state] of Object.entries(addressSubscribeCache)) {
      // Add address in the cache to the set of addresses to watch
      const { path, processing: subscribed } = state
      // only process newly watched addresses
      if (subscribed) continue
      if (path != null) {
        // Add the newly watched addresses to the UTXO cache
        addressUtxoCache[address] = {
          processing: false,
          path
        }
        await addToAddressTransactionCache(
          args,
          address,
          path.format,
          path.changeIndex,
          blockHeight,
          addressTransactionCache
        )
      }
      state.processing = true
    }

    taskCache.addressWatching = true

    const queryTime = Date.now()
    const deferred = new Deferred<unknown>()
    deferred.promise
      .then(() => {
        serverStates.serverScoreUp(uri, Date.now() - queryTime)
      })
      .catch(() => {
        taskCache.addressWatching = false
      })
    deferred.promise.catch(() => {
      taskCache.addressWatching = false
    })
    serverStates.watchAddresses(
      uri,
      Array.from(Object.keys(addressSubscribeCache)),
      deferred
    )
    return true
  }

  // filled when transactions potentially changed (e.g. through new block notification)
  if (Object.keys(updateTransactionCache).length > 0) {
    let hasProcessedAtLeastOnce = false
    for (const [txId, state] of Object.entries(updateTransactionCache)) {
      if (!state.processing && serverStates.serverCanGetTx(uri, txId)) {
        hasProcessedAtLeastOnce = true
        state.processing = true
        removeItem(updateTransactionCache, txId)
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
    // This condition prevents infinite loops
    if (hasProcessedAtLeastOnce) return true
  }

  // loop to get and process transaction history of single addresses, triggers setLookAhead
  for (const [address, state] of Object.entries(addressTransactionCache)) {
    if (!state.processing && serverStates.serverCanGetAddress(uri, address)) {
      state.processing = true

      removeItem(addressTransactionCache, address)

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
): WsTask<TransactionResponse> => {
  const { emitter, walletTools, txId, pluginInfo, processor, taskCache } = args
  const deferred = new Deferred<TransactionResponse>()
  deferred.promise
    .then(async (rawTx: TransactionResponse) => {
      // check if raw tx is still not confirmed, if so, don't change anything
      if (rawTx.blockHeight < 1) return
      // Create new tx from raw tx
      const tx = processRawTx({ ...args, tx: rawTx })
      // Remove any existing input utxos from the processor
      for (const input of tx.inputs) {
        await processor.removeUtxos([`${input.txId}_${input.outputIndex}`])
      }
      // Process and save new tx
      const processedTx = await processor.saveTransaction({
        tx
      })
      await transactionChanged({
        emitter,
        walletTools,
        processor,
        pluginInfo,
        tx: processedTx
      })
    })
    .catch(() => {
      taskCache.updateTransactionCache[txId] = { processing: false }
    })
  return {
    ...transactionMessage(txId),
    deferred
  }
}

interface DeriveScriptAddressArgs {
  walletTools: UTXOPluginWalletTools
  engineInfo: EngineInfo
  processor: Processor
  format: CurrencyFormat
  taskCache: TaskCache
  script: string
}

interface DeriveScriptAddressReturn {
  address: string
  scriptPubkey: string
  redeemScript: string
}

const internalDeriveScriptAddress = async ({
  walletTools,
  engineInfo,
  processor,
  format,
  taskCache,
  script
}: DeriveScriptAddressArgs): Promise<DeriveScriptAddressReturn> => {
  if (engineInfo.scriptTemplates == null) {
    throw new Error(
      `cannot derive script address ${script} without defined script template`
    )
  }

  const scriptTemplate = engineInfo.scriptTemplates[script]

  const path: AddressPath = {
    format,
    changeIndex: derivationLevelScriptHash(scriptTemplate),
    addressIndex: 0
  }

  // save the address to the processor and add it to the cache
  const { address, scriptPubkey, redeemScript } = walletTools.getScriptAddress({
    path,
    scriptTemplate
  })
  await processor.saveAddress(
    makeIAddress({ scriptPubkey, redeemScript, path })
  )
  const addresses = new Set<string>()
  addresses.add(address)
  addToAddressSubscribeCache(taskCache, addresses, {
    format: path.format,
    changeIndex: path.changeIndex
  })
  return { address, scriptPubkey, redeemScript }
}

interface GetFreshAddressArgs extends FormatArgs {}

interface GetFreshAddressReturn {
  address: string
  legacyAddress: string
}

const internalGetFreshAddress = async (
  args: GetFreshAddressArgs
): Promise<GetFreshAddressReturn> => {
  const { format, changeIndex: branch, walletTools, processor } = args

  const numAddresses = processor.numAddressesByFormatPath({
    format,
    changeIndex: branch
  })

  const path: AddressPath = {
    format,
    changeIndex: branch,
    // while syncing, we may hit negative numbers when only subtracting. Use the address at /0 in that case.
    addressIndex: Math.max(
      numAddresses - args.pluginInfo.engineInfo.gapLimit,
      0
    )
  }
  const { scriptPubkey } =
    (await processor.fetchAddress(path)) ??
    (await walletTools.getScriptPubkey(path))
  if (scriptPubkey == null) {
    throw new Error('Unknown address path')
  }
  return walletTools.scriptPubkeyToAddress({
    scriptPubkey,
    format
  })
}

interface ProcessAddressTxsArgs extends CommonArgs {
  processing: boolean
  page: number
  blockHeight: number
  path: ChangePath
  address: string
  uri: string
}

const processAddressTransactions = async (
  args: ProcessAddressTxsArgs
): Promise<WsTask<AddressResponse>> => {
  const {
    address,
    page = 1,
    blockHeight,
    emitter,
    pluginInfo,
    processor,
    walletTools,
    path,
    taskCache,
    serverStates,
    uri
  } = args
  const {
    engineInfo: { asBlockbookAddress }
  } = pluginInfo
  const addressTransactionCache = taskCache.addressTransactionCache

  const scriptPubkey = walletTools.addressToScriptPubkey(address)
  const addressData = await processor.fetchAddress(scriptPubkey)
  if (addressData == null) {
    throw new Error(`could not find address with script pubkey ${scriptPubkey}`)
  }

  const queryTime = Date.now()
  const deferred = new Deferred<AddressResponse>()
  deferred.promise
    .then(async (value: AddressResponse) => {
      serverStates.serverScoreUp(uri, Date.now() - queryTime)
      const { transactions = [], txs, unconfirmedTxs, totalPages } = value

      // If address is used and previously not marked as used, mark as used.
      const used = txs > 0 || unconfirmedTxs > 0
      if (!addressData.used && used && page === 1) {
        addressData.used = true
      }

      // Process and save the address's transactions
      for (const rawTx of transactions) {
        const tx = processRawTx({ ...args, tx: rawTx })
        const processedTx = await processor.saveTransaction({
          tx,
          scriptPubkeys: [scriptPubkey]
        })
        await transactionChanged({
          emitter,
          walletTools,
          processor,
          pluginInfo,
          tx: processedTx
        })
      }

      // Halt on finishing the processing of address transaction until
      // we have progressed through all of the blockbook pages
      if (page < totalPages) {
        // Add the address back to the cache, incrementing the page
        addressTransactionCache[address] = {
          path,
          processing: false,
          blockHeight,
          page: page + 1
        }
        return
      }

      // Update the lastQueriedBlockHeight for the address
      addressData.lastQueriedBlockHeight = blockHeight

      // Save/update the fully-processed address
      await processor.saveAddress(addressData)

      // Update the progress now that the transactions for an address have processed
      await args.updateProgressRatio()

      // Call setLookAhead to update the lookahead
      await setLookAhead(args)
    })
    .catch(err => {
      // Log the error for debugging purposes without crashing the engine
      // This will cause frozen wallet syncs
      console.error(err.toString())
      console.log(err.stack)
    })

  return {
    ...addressMessage(address, asBlockbookAddress, {
      details: 'txs',
      from: addressData.lastQueriedBlockHeight,
      pageSize: BLOCKBOOK_TXS_PER_PAGE,
      page
    }),
    deferred
  }
}

interface ProcessRawTxArgs extends CommonArgs {
  tx: TransactionResponse
}

const processRawTx = (args: ProcessRawTxArgs): IProcessorTransaction => {
  const {
    tx,
    pluginInfo: { coinInfo }
  } = args
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
      n: input.n,
      scriptPubkey: validScriptPubkeyFromAddress({
        address: input.addresses[0],
        coin: coinInfo.name
      }),
      amount: input.value
    })),
    outputs: tx.vout.map(output => ({
      n: output.n,
      scriptPubkey:
        output.hex ??
        validScriptPubkeyFromAddress({
          address: output.addresses[0],
          coin: coinInfo.name
        }),
      amount: output.value
    })),
    ourIns: [],
    ourOuts: [],
    ourAmount: '0'
  }
}

interface ProcessAddressUtxosArgs extends CommonArgs {
  processing: boolean
  path: ChangePath
  address: string
  uri: string
}

const processAddressUtxos = async (
  args: ProcessAddressUtxosArgs
): Promise<WsTask<AddressUtxosResponse>> => {
  const {
    address,
    walletTools,
    processor,
    taskCache,
    path,
    pluginInfo,
    serverStates,
    uri
  } = args
  const {
    engineInfo: { asBlockbookAddress }
  } = pluginInfo
  const { addressUtxoCache, rawUtxoCache, processorUtxoCache } = taskCache
  const queryTime = Date.now()
  const deferred = new Deferred<AddressUtxosResponse>()
  deferred.promise
    .then(async (utxos: AddressUtxosResponse) => {
      serverStates.serverScoreUp(uri, Date.now() - queryTime)
      const scriptPubkey = walletTools.addressToScriptPubkey(address)
      const addressData = await processor.fetchAddress(scriptPubkey)
      if (addressData == null || addressData.path == null) {
        return
      }

      if (utxos.length === 0) {
        addToProcessorUtxoCache(processorUtxoCache, path, scriptPubkey, 0)
        return
      }

      for (const utxo of utxos) {
        rawUtxoCache[JSON.stringify(utxo)] = {
          processing: false,
          requiredCount: utxos.length,
          path,
          // TypeScript yells otherwise
          address: { ...addressData, path: addressData.path }
        }
      }
    })
    .catch(() => {
      args.processing = false
      addressUtxoCache[address] = {
        processing: args.processing,
        path
      }
    })

  return {
    ...addressUtxosMessage(address, asBlockbookAddress),
    deferred
  }
}

interface ProcessUtxoTransactionArgs extends CommonArgs {
  scriptPubkey: string
  utxos: Set<IUTXO>
  path: ChangePath
}

const processProcessorUtxos = async (
  args: ProcessUtxoTransactionArgs
): Promise<void> => {
  const {
    utxos,
    processor,
    scriptPubkey,
    log,
    emitter,
    pluginInfo: { currencyInfo }
  } = args

  const currentUtxos = await processor.fetchUtxos({ scriptPubkey })
  const currentUtxoIds: string[] = []
  let oldBalance = '0'
  for (const utxo of currentUtxos) {
    if (utxo == null)
      throw new Error(
        'Unexpected undefined utxo when processing unspent transactions'
      )
    oldBalance = add(utxo.value, oldBalance)
    currentUtxoIds.push(utxo.id)
  }
  await processor.removeUtxos(currentUtxoIds)

  let newBalance = '0'
  for (const utxo of Array.from(utxos)) {
    newBalance = add(utxo.value, newBalance)
    await processor.saveUtxo(utxo)
  }

  const diff = sub(newBalance, oldBalance)
  if (diff !== '0') {
    log('balance changed:', { scriptPubkey, diff })
    emitter.emit(
      EngineEvent.ADDRESS_BALANCE_CHANGED,
      currencyInfo.currencyCode,
      diff
    )

    // Update balances for address that have this scriptPubkey
    const address = await processor.fetchAddress(scriptPubkey)

    if (address == null) {
      throw new Error('address not found when processing UTXO transactions')
    }

    await processor.saveAddress({
      ...address,
      balance: newBalance,
      used: true
    })
  }

  // Update the progress now that the UTXOs for an address have been processed
  await args.updateProgressRatio()

  await setLookAhead(args).catch(err => {
    log.error(err)
    throw err
  })
}

interface ProcessRawUtxoArgs extends CommonArgs {
  path: ChangePath
  requiredCount: number
  utxo: BlockbookAccountUtxo
  id: string
  address: IAddress
  uri: string
}

const processRawUtxo = async (
  args: ProcessRawUtxoArgs
): Promise<WsTask<TransactionResponse> | undefined> => {
  const {
    utxo,
    id,
    address,
    processor,
    path,
    taskCache,
    requiredCount,
    serverStates,
    uri,
    log
  } = args
  const { rawUtxoCache, processorUtxoCache } = taskCache
  let scriptType: ScriptTypeEnum
  let script: string
  let redeemScript: string | undefined

  // Function to call once we are finished
  const done = (): void =>
    addToProcessorUtxoCache(
      processorUtxoCache,
      path,
      address.scriptPubkey,
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
        blockHeight: utxo.height ?? -1,
        spent: false
      }
    )

  switch (currencyFormatToPurposeType(path.format)) {
    case BIP43PurposeTypeEnum.Airbitz:
    case BIP43PurposeTypeEnum.Legacy:
      scriptType = ScriptTypeEnum.p2pkh
      if (address.redeemScript != null) {
        scriptType = ScriptTypeEnum.p2sh
        redeemScript = address.redeemScript
      }

      // Legacy UTXOs need the previous transaction hex as the script
      // If we do not currently have it, add it to the queue to fetch it
      {
        const [tx] = await processor.fetchTransactions({ txId: utxo.txid })
        if (tx == null) {
          const queryTime = Date.now()
          const deferred = new Deferred<TransactionResponse>()
          deferred.promise
            .then((rawTx: TransactionResponse) => {
              serverStates.serverScoreUp(uri, Date.now() - queryTime)
              const processedTx = processRawTx({ ...args, tx: rawTx })
              script = processedTx.hex
              // Only after we have successfully fetched the tx, set our script and call done
              done()
            })
            .catch(e => {
              // If something went wrong, add the UTXO back to the queue
              log('error in processed utxos cache, re-adding utxo to cache:', e)
              rawUtxoCache[JSON.stringify(utxo)] = {
                processing: false,
                path,
                address,
                requiredCount
              }
            })
          return {
            ...transactionMessage(utxo.txid),
            deferred
          }
        } else {
          script = tx.hex
        }
      }

      break
    case BIP43PurposeTypeEnum.WrappedSegwit:
      scriptType = ScriptTypeEnum.p2wpkhp2sh
      script = address.scriptPubkey
      if (address.redeemScript == null) {
        throw new Error(
          'Address redeem script not defined, but required for p2sh wrapped segwit utxo processing'
        )
      }
      redeemScript = address.redeemScript

      break
    case BIP43PurposeTypeEnum.Segwit:
      scriptType = ScriptTypeEnum.p2wpkh
      script = address.scriptPubkey

      break
  }

  // Since we have everything, call done
  done()
}

const addToProcessorUtxoCache = (
  processorUtxosCache: ProcessorUtxoCache,
  path: ChangePath,
  scriptPubkey: string,
  requiredCount: number,
  utxo?: IUTXO
): void => {
  const processorUtxos = processorUtxosCache[scriptPubkey] ?? {
    utxos: new Set(),
    processing: false,
    path,
    full: false
  }
  if (utxo != null) processorUtxos.utxos.add(utxo)
  processorUtxosCache[scriptPubkey] = processorUtxos
  processorUtxos.full = processorUtxos.utxos.size >= requiredCount
}
