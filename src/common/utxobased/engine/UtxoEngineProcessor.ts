import { add } from 'biggystring'
import { asMaybe } from 'cleaners'
import {
  EdgeFreshAddress,
  EdgeIo,
  EdgeLog,
  EdgeTransaction
} from 'edge-core-js/types'

import { EngineEmitter, EngineEvent } from '../../plugin/EngineEmitter'
import { PluginState } from '../../plugin/PluginState'
import {
  AddressPath,
  ChangePath,
  CurrencyFormat,
  EngineConfig,
  EngineInfo,
  PluginInfo
} from '../../plugin/types'
import { removeItem } from '../../plugin/utils'
import { DataLayer } from '../db/DataLayer'
import { toEdgeTransaction } from '../db/Models/TransactionData'
import {
  AddressData,
  makeAddressData,
  TransactionData,
  UtxoData
} from '../db/types'
import { getSupportedFormats, SafeWalletInfo } from '../keymanager/cleaners'
import {
  BIP43PurposeTypeEnum,
  derivationLevelScriptHash,
  ScriptTypeEnum
} from '../keymanager/keymanager'
import {
  AddressResponse,
  AddressUtxosResponse,
  BlockbookAccountUtxo,
  SubscribeAddressResponse,
  TransactionResponse
} from '../network/blockbookApi'
import Deferred from '../network/Deferred'
import { WsTask } from '../network/Socket'
import AwaitLock from './await-lock'
import { CACHE_THROTTLE } from './constants'
import { makeServerStates, ServerStates } from './ServerStates'
import {
  getFormatSupportedBranches,
  getScriptTypeFromPurposeType,
  pathToPurposeType,
  validScriptPubkeyFromAddress
} from './utils'
import { UtxoWalletTools } from './UtxoWalletTools'

export interface UtxoEngineProcessor {
  processedPercent: number

  start: () => Promise<void>

  stop: () => Promise<void>

  deriveScriptAddress: (script: string) => Promise<EdgeFreshAddress>

  getFreshAddress: (params: {
    branch?: number
    forceIndex?: number
  }) => Promise<EdgeFreshAddress>

  addGapLimitAddresses: (addresses: string[]) => Promise<void>

  broadcastTx: (transaction: EdgeTransaction) => Promise<string>

  refillServers: () => void

  getServerList: () => string[]

  setServerList: (serverList: string[]) => void

  loadWifs: (wifs: string[]) => Promise<void>

  processUtxos: (utxos: UtxoData[]) => Promise<void>
}

export interface UtxoEngineProcessorConfig extends EngineConfig {
  walletTools: UtxoWalletTools
  walletInfo: SafeWalletInfo
  dataLayer: DataLayer
}

export function makeUtxoEngineProcessor(
  config: UtxoEngineProcessorConfig
): UtxoEngineProcessor {
  const {
    initOptions,
    io,
    options,
    pluginState,
    pluginInfo,
    dataLayer,
    walletInfo,
    walletTools
  } = config
  const { emitter, log } = options

  const { walletFormats } = walletInfo.keys

  const taskCache: TaskCache = {
    blockWatching: false,
    addressSubscribeCache: {},
    addressTransactionCache: {},
    addressUtxoCache: {},
    rawUtxoCache: {},
    dataLayerUtxoCache: {},
    updateTransactionCache: {},
    updateTransactionSpecificCache: {}
  }

  const clearTaskCache = (): void => {
    taskCache.blockWatching = false
    for (const key of Object.keys(taskCache.addressSubscribeCache)) {
      removeItem(taskCache.addressSubscribeCache, key)
    }
    for (const key of Object.keys(taskCache.addressTransactionCache)) {
      removeItem(taskCache.addressTransactionCache, key)
    }
    for (const key of Object.keys(taskCache.addressUtxoCache)) {
      removeItem(taskCache.addressUtxoCache, key)
    }
    for (const key of Object.keys(taskCache.rawUtxoCache)) {
      removeItem(taskCache.rawUtxoCache, key)
    }
    for (const key of Object.keys(taskCache.dataLayerUtxoCache)) {
      removeItem(taskCache.dataLayerUtxoCache, key)
    }
    for (const key of Object.keys(taskCache.updateTransactionCache)) {
      removeItem(taskCache.updateTransactionCache, key)
    }
    for (const key of Object.keys(taskCache.updateTransactionSpecificCache)) {
      removeItem(taskCache.updateTransactionSpecificCache, key)
    }
  }

  /**
   * There are two processes that need to complete per address:
   * 1. Address transaction processing
   * 2. Address UTXO processing
   **/
  const processesPerAddress = 2
  let processedCount = 0
  let processedPercent = 0 // last sync ratio emitted
  const updateProgressRatio = async (): Promise<void> => {
    // Avoid re-sending sync ratios / sending ratios larger than 1
    if (processedPercent >= 1) return

    // We expect the total number of progress updates to equal the number of
    // addresses multiplied the number of processes per address.
    const expectedProcessCount =
      Object.keys(taskCache.addressSubscribeCache).length * processesPerAddress

    // Increment the processed count
    processedCount = processedCount + 1

    // If we have no addresses, we should not have not yet began processing.
    if (expectedProcessCount === 0) throw new Error('No addresses to process')

    const percent = processedCount / expectedProcessCount
    if (percent - processedPercent > CACHE_THROTTLE || percent === 1) {
      log(
        `processed changed, percent: ${percent}, processedCount: ${processedCount}, totalCount: ${expectedProcessCount}`
      )
      processedPercent = percent
      emitter.emit(EngineEvent.ADDRESSES_CHECKED, percent)
    }
  }

  const lock = new AwaitLock()

  const serverStates = makeServerStates({
    engineEmitter: emitter,
    initOptions,
    io,
    log,
    pluginInfo,
    pluginState,
    walletInfo
  })
  const commonArgs: CommonArgs = {
    pluginInfo,
    walletInfo,
    walletTools,
    dataLayer,
    emitter,
    taskCache,
    updateProgressRatio,
    io,
    log,
    serverStates,
    pluginState,
    walletFormats,
    lock
  }

  serverStates.setPickNextTaskCB(async serverUri => {
    return await pickNextTask(commonArgs, serverUri)
  })

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
      const txs = await dataLayer.fetchTransactions({
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
          path,
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
  // processed by the DataLayer. This happens only once before any call to
  // setLookAhead.
  const initializeAddressSubscriptions = async (): Promise<void> => {
    const addressBalanceChanges: Array<{
      scriptPubkey: string
      balance: string
    }> = []

    for (const format of walletFormats) {
      const branches = getFormatSupportedBranches(pluginInfo.engineInfo, format)
      for (const branch of branches) {
        const addressesToSubscribe = new Set<string>()
        const changePath = {
          format,
          changeIndex: branch
        }
        const branchAddressCount = dataLayer.numAddressesByFormatPath(
          changePath
        )
        // If the DataLayer has not processed any addresses then the loop
        // condition will only iterate once when branchAddressCount is 0 for the
        // first address in the derivation path.
        for (
          let addressIndex = 0;
          addressIndex < branchAddressCount;
          addressIndex++
        ) {
          const addressData = await dataLayer.fetchAddress({
            format,
            changeIndex: branch,
            addressIndex
          })
          if (addressData == null) {
            throw new Error(
              `Missing data-layer address with '${format}/${branch}/${addressIndex}' path during initialization`
            )
          }
          const { address } = walletTools.scriptPubkeyToAddress({
            changePath,
            scriptPubkey: addressData.scriptPubkey
          })
          addressesToSubscribe.add(address)
          if (addressData.balance != null) {
            addressBalanceChanges.push({
              scriptPubkey: addressData.scriptPubkey,
              balance: addressData.balance
            })
          }
        }
        addToAddressSubscribeCache(commonArgs.taskCache, addressesToSubscribe, {
          format,
          changeIndex: branch
        })
      }
    }

    // Only emit address balance events after processing all initial addresses
    // because we want to only propagate the wallet balance change event after
    // initialization is complete.
    emitter.emit(
      EngineEvent.ADDRESS_BALANCE_CHANGED,
      pluginInfo.currencyInfo.currencyCode,
      addressBalanceChanges
    )
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

    async getFreshAddress({
      branch = 0,
      forceIndex
    }): Promise<EdgeFreshAddress> {
      const { privateKeyFormat } = walletInfo.keys

      // Airbitz wallets only use branch 0
      if (privateKeyFormat === 'bip32') branch = 0

      const {
        address: publicAddress,
        nativeBalance = '0',
        legacyAddress
      } = await internalGetFreshAddress({
        ...commonArgs,
        forceIndex,
        changePath: {
          format: privateKeyFormat,
          changeIndex: branch
        }
      })

      const freshAddress: EdgeFreshAddress = {
        publicAddress,
        nativeBalance,
        legacyAddress:
          legacyAddress !== publicAddress ? legacyAddress : undefined,
        // Legacy address is just a different encoding of the standard public address
        // and therefore would have the same balance
        legacyNativeBalance:
          legacyAddress !== publicAddress ? nativeBalance : undefined
      }

      // Exclude the privateKeyFormat because it's covered by 'publicAddress'
      const supportedFormats = getSupportedFormats(
        pluginInfo.engineInfo,
        walletInfo.keys.privateKeyFormat
      ).filter(format => format !== privateKeyFormat)

      // Loop over all other supported formats for their equivalent address:
      for (const format of supportedFormats) {
        if (format === 'bip84') {
          const {
            address,
            nativeBalance = '0'
          } = await internalGetFreshAddress({
            ...commonArgs,
            forceIndex,
            changePath: {
              format,
              changeIndex: branch
            }
          })

          freshAddress.segwitAddress = address
          freshAddress.segwitNativeBalance = nativeBalance
        }
      }

      return freshAddress
    },

    async deriveScriptAddress(script): Promise<EdgeFreshAddress> {
      const { address } = await internalDeriveScriptAddress({
        walletTools: commonArgs.walletTools,
        engineInfo: commonArgs.pluginInfo.engineInfo,
        dataLayer: commonArgs.dataLayer,
        taskCache: commonArgs.taskCache,
        format: walletInfo.keys.privateKeyFormat,
        script
      })
      return {
        publicAddress: address
      }
    },

    async addGapLimitAddresses(addresses: string[]): Promise<void> {
      const promises = addresses.map(async address => {
        const scriptPubkey = walletTools.addressToScriptPubkey(address)
        await dataLayer.saveAddress(
          makeAddressData({
            scriptPubkey,
            used: true
          })
        )
      })
      await Promise.all(promises)
      await run()
    },

    async broadcastTx(transaction: EdgeTransaction): Promise<string> {
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
            changePath: path,
            scriptPubkey
          })

          // Make a new IAddress and save it
          await dataLayer.saveAddress(
            makeAddressData({ scriptPubkey, redeemScript, path })
          )

          taskCache.addressSubscribeCache[address] = {
            path: changePath,
            processing: false
          }
        }
      }
    },
    async processUtxos(utxos: UtxoData[]) {
      const utxoMap: Map<string, UtxoData[]> = new Map()
      const utxoIds: Set<string> = new Set()

      // Map updated utxos
      for (const utxo of utxos) {
        const utxoSet = utxoMap.get(utxo.scriptPubkey) ?? []
        if (!utxoMap.has(utxo.scriptPubkey))
          utxoMap.set(utxo.scriptPubkey, utxoSet)
        // Add utxo to set for scriptPubkey
        utxoSet.push(utxo)
        // Add UTXO ID set
        utxoIds.add(utxo.id)
      }

      // Process UTXO sets for each scriptPubkey in map
      for (const [scriptPubkey, utxos] of utxoMap.entries()) {
        // Get saved utxo set
        const savedUtxos = await dataLayer.fetchUtxos({ scriptPubkey })
        // Filter UTXOs to de-duplicate (and undefined utxo as a type assert)
        const filteredUtxos = savedUtxos.filter(
          utxo => utxo != null && !utxoIds.has(utxo?.id)
        ) as UtxoData[]

        // Add updated utxos to utxo set
        const combinedUtxos = [...filteredUtxos, ...utxos]

        await processDataLayerUtxos({
          ...commonArgs,
          scriptPubkey,
          utxos: combinedUtxos
        })
      }
    }
  }
}

interface CommonArgs {
  pluginInfo: PluginInfo
  walletInfo: SafeWalletInfo
  walletTools: UtxoWalletTools
  dataLayer: DataLayer
  emitter: EngineEmitter
  taskCache: TaskCache
  updateProgressRatio: () => void
  io: EdgeIo
  log: EdgeLog
  serverStates: ServerStates
  pluginState: PluginState
  walletFormats: CurrencyFormat[]
  lock: AwaitLock
}

interface TaskCache {
  blockWatching: boolean
  readonly addressSubscribeCache: AddressSubscribeCache
  readonly addressUtxoCache: AddressUtxoCache
  readonly rawUtxoCache: RawUtxoCache
  readonly dataLayerUtxoCache: DataLayerUtxoCache
  readonly addressTransactionCache: AddressTransactionCache
  readonly updateTransactionCache: UpdateTransactionCache
  readonly updateTransactionSpecificCache: UpdateTransactionSpecificCache
}

interface UpdateTransactionCache {
  [key: string]: { processing: boolean }
}
interface UpdateTransactionSpecificCache {
  [key: string]: { processing: boolean }
}
interface AddressSubscribeCache {
  [key: string]: { processing: boolean; path: ChangePath }
}
interface AddressUtxoCache {
  [key: string]: { processing: boolean; path: ChangePath }
}
interface DataLayerUtxoCache {
  [key: string]: {
    processing: boolean
    full: boolean
    utxos: UtxoData[]
    path: ChangePath
  }
}
interface RawUtxoCache {
  [key: string]: {
    blockbookUtxo: BlockbookAccountUtxo
    processing: boolean
    path: ChangePath
    address: AddressData
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

const setLookAhead = async (common: CommonArgs): Promise<void> => {
  const {
    pluginInfo: { engineInfo },
    lock,
    dataLayer,
    walletFormats,
    walletTools
  } = common

  // Wait for the lock to be released before continuing invocation.
  // This is to ensure that setLockAhead is not called while the lock is held.
  await lock.acquireAsync()

  try {
    for (const format of walletFormats) {
      const branches = getFormatSupportedBranches(engineInfo, format)
      for (const branch of branches) {
        await deriveKeys({ format, changeIndex: branch })
      }
    }
  } finally {
    lock.release()
  }

  async function deriveKeys(changePath: ChangePath): Promise<void> {
    const addressesToSubscribe = new Set<string>()
    const totalAddressCount = dataLayer.numAddressesByFormatPath(changePath)
    let lastUsedIndex = await dataLayer.lastUsedIndexByFormatPath(changePath)

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
        changePath: path,
        scriptPubkey
      })

      // Make a new IAddress and save it
      await dataLayer.saveAddress(
        makeAddressData({ scriptPubkey, redeemScript, path })
      )

      // Add the displayAddress to the set of addresses to subscribe to after loop
      addressesToSubscribe.add(address)

      // Update the state for the loop
      lastUsedIndex = await dataLayer.lastUsedIndexByFormatPath(changePath)
      lookAheadIndex = lastUsedIndex + engineInfo.gapLimit
      nextAddressIndex = dataLayer.numAddressesByFormatPath(changePath)
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
  })
}

const addToAddressTransactionCache = async (
  common: CommonArgs,
  address: string,
  changePath: ChangePath,
  blockHeight: number,
  addressTransactionCache: AddressTransactionCache
): Promise<void> => {
  const { walletTools, dataLayer } = common
  // Fetch the blockHeight for the address from the database
  const scriptPubkey = walletTools.addressToScriptPubkey(address)

  if (blockHeight === 0) {
    const { lastQueriedBlockHeight = 0 } =
      (await dataLayer.fetchAddress(scriptPubkey)) ?? {}
    blockHeight = lastQueriedBlockHeight
  }

  addressTransactionCache[address] = {
    processing: false,
    path: changePath,
    page: 1, // Page starts on 1
    blockHeight
  }
}

interface TransactionChangedArgs {
  walletId: string
  tx: TransactionData
  emitter: EngineEmitter
  walletTools: UtxoWalletTools
  pluginInfo: PluginInfo
  dataLayer: DataLayer
}

export const transactionChanged = async (
  args: TransactionChangedArgs
): Promise<void> => {
  const { emitter, walletTools, dataLayer, pluginInfo, tx, walletId } = args
  emitter.emit(EngineEvent.TRANSACTIONS_CHANGED, [
    await toEdgeTransaction({
      walletId,
      tx,
      walletTools,
      dataLayer,
      pluginInfo
    })
  ])
}

export const pickNextTask = async (
  args: CommonArgs,
  serverUri: string
): Promise<WsTask<any> | undefined | boolean> => {
  const { pluginInfo, taskCache, serverStates } = args

  const {
    addressSubscribeCache,
    addressUtxoCache,
    rawUtxoCache,
    dataLayerUtxoCache,
    addressTransactionCache,
    updateTransactionCache,
    updateTransactionSpecificCache
  } = taskCache

  /**
   * Some currencies require an additional blockbook payload 'getTransactionSpecific' in order
   * to provide all relevant transaction data. Since this is currency-specific, we can limit
   * the useage to currencies that require it.
   **/
  const needsTxSpecific = pluginInfo.engineInfo.txSpecificHandling != null

  const serverState = serverStates.getServerState(serverUri)
  if (serverState == null) return

  // subscribe all servers to new blocks
  if (serverState.blockSubscriptionStatus === 'unsubscribed') {
    serverStates.watchBlocks(serverUri)
    return true
  }

  // Loop processed utxos, these are just database ops, triggers setLookAhead
  if (Object.keys(dataLayerUtxoCache).length > 0) {
    for (const [scriptPubkey, state] of Object.entries(dataLayerUtxoCache)) {
      // Only process when all utxos for a specific address have been gathered
      if (!state.processing && state.full) {
        state.processing = true
        await processDataLayerUtxos({
          ...args,
          scriptPubkey,
          utxos: state.utxos
        })
        removeItem(dataLayerUtxoCache, scriptPubkey)
        return true
      }
    }
  }

  // Loop unparsed utxos, some require a network call to get the full tx data
  for (const [utxoId, state] of Object.entries(rawUtxoCache)) {
    const utxo = state.blockbookUtxo
    if (utxo == null) continue
    if (!state.processing) {
      // check if we need to fetch additional network content for legacy purpose type
      const purposeType = pathToPurposeType(
        state.path,
        pluginInfo.engineInfo.scriptTemplates
      )
      if (
        purposeType === BIP43PurposeTypeEnum.Airbitz ||
        purposeType === BIP43PurposeTypeEnum.Legacy ||
        purposeType === BIP43PurposeTypeEnum.ReplayProtection
      ) {
        // if we do need to make a network call, check with the serverState
        if (!serverStates.serverCanGetTx(serverUri, utxo.txid)) return
      }
      state.processing = true
      removeItem(rawUtxoCache, utxoId)
      const wsTask = await processRawUtxo({
        ...args,
        ...state,
        address: state.address,
        serverUri,
        utxo,
        id: `${utxo.txid}_${utxo.vout}`
      })
      return wsTask ?? true
    }
  }

  // Loop to process addresses to utxos
  for (const [address, state] of Object.entries(addressUtxoCache)) {
    // Check if we need to fetch address UTXOs
    if (
      !state.processing &&
      serverStates.serverCanGetAddress(serverUri, address)
    ) {
      state.processing = true

      removeItem(addressUtxoCache, address)

      // Fetch and process address UTXOs
      const wsTask = await processAddressUtxos({
        ...args,
        ...state,
        address,
        serverUri
      })
      wsTask.deferred.promise
        .then(() => {
          serverState.addresses.add(address)
        })
        .catch(err => {
          addressUtxoCache[address] = state
          console.error(err)
          args.log('error in addressUtxoCache:', err)
        })
      return wsTask
    }
  }

  // Check if there are any addresses pending to be subscribed
  if (Object.keys(addressSubscribeCache).length > 0) {
    // These are addresses to which the server has not subscribed
    const newAddresses: string[] = []
    const blockHeight = serverStates.getBlockHeight(serverUri)

    // Loop each address in the cache
    for (const [address, state] of Object.entries(addressSubscribeCache)) {
      const isAddressNewlySubscribed = !serverStates.serverIsAwareOfAddress(
        serverUri,
        address
      )

      // Add address in the cache to the set of addresses to watch
      if (isAddressNewlySubscribed) {
        newAddresses.push(address)
      }

      // Add to the addressTransactionCache if they're not yet added:
      // Only process newly watched addresses
      if (state.processing) continue

      // Add the newly watched addresses to the UTXO cache
      if (isAddressNewlySubscribed) {
        addressUtxoCache[address] = {
          processing: false,
          path: state.path
        }
      }

      await addToAddressTransactionCache(
        args,
        address,
        state.path,
        blockHeight,
        addressTransactionCache
      )
      state.processing = true
    }

    // Subscribe to any new addresses
    if (newAddresses.length > 0) {
      serverStates.watchAddresses(serverUri, newAddresses)
      return true
    }
  }

  // filled when transactions potentially changed (e.g. through new block notification)
  if (Object.keys(updateTransactionSpecificCache).length > 0) {
    let hasProcessedAtLeastOnce = false
    for (const [txId, state] of Object.entries(
      updateTransactionSpecificCache
    )) {
      if (!state.processing && serverStates.serverCanGetTx(serverUri, txId)) {
        hasProcessedAtLeastOnce = true
        state.processing = true
        removeItem(updateTransactionSpecificCache, txId)
        const updateTransactionSpecificTask = updateTransactionsSpecific({
          ...args,
          serverUri,
          txId
        })
        // once resolved, add the txid to the server cache
        updateTransactionSpecificTask.deferred.promise
          .then(() => {
            serverState.txids.add(txId)
          })
          .catch(err => {
            updateTransactionSpecificCache[txId] = state
            console.error(err)
            args.log('error in updateTransactionSpecificCache:', err)
          })
        return updateTransactionSpecificTask
      }
    }
    // This condition prevents infinite loops
    if (hasProcessedAtLeastOnce) return true
  }

  // filled when transactions potentially changed (e.g. through new block notification)
  if (Object.keys(updateTransactionCache).length > 0) {
    let hasProcessedAtLeastOnce = false
    for (const [txId, state] of Object.entries(updateTransactionCache)) {
      if (!state.processing && serverStates.serverCanGetTx(serverUri, txId)) {
        hasProcessedAtLeastOnce = true
        state.processing = true
        removeItem(updateTransactionCache, txId)
        const updateTransactionTask = updateTransactions({
          ...args,
          serverUri,
          needsTxSpecific,
          txId
        })
        // once resolved, add the txid to the server cache
        updateTransactionTask.deferred.promise
          .then(() => {
            serverState.txids.add(txId)
          })
          .catch(err => {
            updateTransactionCache[txId] = state
            console.error(err)
            args.log('error in updateTransactionCache:', err)
          })
        return updateTransactionTask
      }
    }
    // This condition prevents infinite loops
    if (hasProcessedAtLeastOnce) return true
  }

  // loop to get and process transaction history of single addresses, triggers setLookAhead
  for (const [address, state] of Object.entries(addressTransactionCache)) {
    if (
      !state.processing &&
      serverStates.serverCanGetAddress(serverUri, address)
    ) {
      state.processing = true

      removeItem(addressTransactionCache, address)

      // Fetch and process address UTXOs
      const wsTask = await processAddressTransactions({
        ...args,
        addressTransactionState: state,
        address,
        needsTxSpecific,
        serverUri
      })
      wsTask.deferred.promise
        .then(() => {
          serverState.addresses.add(address)
        })
        .catch(err => {
          addressTransactionCache[address] = state
          console.error(err)
          args.log('error in updateTransactionCache:', err)
        })
      return wsTask
    }
  }
}

interface UpdateTransactionsSpecificArgs extends CommonArgs {
  serverUri: string
  txId: string
}

const updateTransactionsSpecific = (
  args: UpdateTransactionsSpecificArgs
): WsTask<unknown> => {
  const {
    walletInfo,
    emitter,
    walletTools,
    pluginInfo,
    dataLayer,
    serverUri,
    txId,
    taskCache
  } = args
  const deferred = new Deferred<unknown>()
  deferred.promise
    .then(async (txResponse: unknown) => {
      // Grab tx to update it
      const txs = await dataLayer.fetchTransactions({ txId })
      let tx = txs[0]
      if (tx == null) return

      if (pluginInfo.engineInfo.txSpecificHandling != null) {
        // Do coin-specific things to it
        tx = pluginInfo.engineInfo.txSpecificHandling(tx, txResponse)
      }

      // Process and save new tx
      const processedTx = await dataLayer.saveTransaction({
        tx
      })

      await transactionChanged({
        walletId: walletInfo.id,
        emitter,
        walletTools,
        dataLayer,
        pluginInfo,
        tx: processedTx
      })
    })
    .catch(err => {
      console.error(err)
      args.log('error in updateTransactionsSpecific:', err)
      taskCache.updateTransactionSpecificCache[txId] = { processing: false }
    })

  return args.serverStates.transactionSpecialQueryTask(
    serverUri,
    txId,
    deferred
  )
}

interface UpdateTransactionsArgs extends CommonArgs {
  needsTxSpecific: boolean
  serverUri: string
  txId: string
}

const updateTransactions = (
  args: UpdateTransactionsArgs
): WsTask<TransactionResponse> => {
  const {
    walletInfo,
    emitter,
    walletTools,
    txId,
    needsTxSpecific,
    pluginInfo,
    dataLayer,
    serverUri,
    taskCache
  } = args
  const deferred = new Deferred<TransactionResponse>()
  deferred.promise
    .then(async (txResponse: TransactionResponse) => {
      // check if raw tx is still not confirmed, if so, don't change anything
      if (txResponse.blockHeight < 1) return
      // Create new tx from raw tx
      const tx = processTransactionResponse({ ...args, txResponse })
      // Remove any existing input utxos from the dataLayer
      for (const input of tx.inputs) {
        await dataLayer.removeUtxos([`${input.txId}_${input.outputIndex}`])
      }
      // Update output utxos's blockHeight any existing input utxos from the dataLayer
      const utxoIds = tx.outputs.map(output => `${tx.txid}_${output.n}`)
      const utxos = await dataLayer.fetchUtxos({
        utxoIds
      })
      for (const utxo of utxos) {
        if (utxo == null) continue
        utxo.blockHeight = tx.blockHeight
        await dataLayer.saveUtxo(utxo)
      }
      // Process and save new tx
      const processedTx = await dataLayer.saveTransaction({
        tx
      })

      await transactionChanged({
        walletId: walletInfo.id,
        emitter,
        walletTools,
        dataLayer,
        pluginInfo,
        tx: processedTx
      })

      if (needsTxSpecific) {
        // Add task to grab transactionSpecific payload
        taskCache.updateTransactionSpecificCache[txId] = {
          processing: false
        }
      }
    })
    .catch(err => {
      console.error(err)
      args.log('error in updateTransactions:', err)
      taskCache.updateTransactionCache[txId] = { processing: false }
    })

  return args.serverStates.transactionQueryTask(serverUri, txId, deferred)
}

interface DeriveScriptAddressArgs {
  walletTools: UtxoWalletTools
  engineInfo: EngineInfo
  dataLayer: DataLayer
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
  dataLayer,
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

  // save the address to the dataLayer and add it to the cache
  const { address, scriptPubkey, redeemScript } = walletTools.getScriptAddress({
    path,
    scriptTemplate
  })
  await dataLayer.saveAddress(
    makeAddressData({ scriptPubkey, redeemScript, path })
  )
  const addresses = new Set<string>()
  addresses.add(address)
  addToAddressSubscribeCache(taskCache, addresses, {
    format: path.format,
    changeIndex: path.changeIndex
  })
  return { address, scriptPubkey, redeemScript }
}

interface GetFreshAddressArgs extends CommonArgs {
  forceIndex?: number
  changePath: ChangePath
}

interface GetFreshAddressReturn {
  address: string
  legacyAddress: string
  nativeBalance?: string
}

const internalGetFreshAddress = async (
  args: GetFreshAddressArgs
): Promise<GetFreshAddressReturn> => {
  const { changePath, walletTools, dataLayer, forceIndex } = args

  const numAddresses = dataLayer.numAddressesByFormatPath(changePath)

  const path: AddressPath = {
    format: changePath.format,
    changeIndex: changePath.changeIndex,
    // while syncing, we may hit negative numbers when only subtracting. Use the address at /0 in that case.
    addressIndex: Math.max(
      numAddresses - args.pluginInfo.engineInfo.gapLimit,
      0
    )
  }
  if (forceIndex != null) {
    path.addressIndex = forceIndex
  }

  const iAddress = await dataLayer.fetchAddress(path)
  const nativeBalance = iAddress?.balance ?? '0'
  const { scriptPubkey } = iAddress ?? (await walletTools.getScriptPubkey(path))

  if (scriptPubkey == null) {
    throw new Error('Unknown address path')
  }
  const address = walletTools.scriptPubkeyToAddress({
    changePath: path,
    scriptPubkey
  })

  return {
    ...address,
    nativeBalance
  }
}

interface ProcessAddressTxsArgs extends CommonArgs {
  address: string
  addressTransactionState: AddressTransactionCache[string]
  serverUri: string
  needsTxSpecific: boolean
}

const processAddressTransactions = async (
  args: ProcessAddressTxsArgs
): Promise<WsTask<AddressResponse>> => {
  const {
    walletInfo,
    address,
    addressTransactionState,
    emitter,
    needsTxSpecific,
    pluginInfo,
    dataLayer,
    walletTools,
    taskCache,
    pluginState,
    serverUri
  } = args
  const { page = 1, blockHeight } = addressTransactionState
  const addressTransactionCache = taskCache.addressTransactionCache

  const scriptPubkey = walletTools.addressToScriptPubkey(address)
  const addressData = await dataLayer.fetchAddress(scriptPubkey)
  if (addressData == null) {
    throw new Error(`could not find address with script pubkey ${scriptPubkey}`)
  }

  const queryTime = Date.now()
  const deferred = new Deferred<AddressResponse>()
  deferred.promise
    .then(async (value: AddressResponse) => {
      pluginState.serverScoreUp(serverUri, Date.now() - queryTime)
      const { transactions = [], txs, unconfirmedTxs, totalPages } = value

      // If address is used and previously not marked as used, mark as used.
      const used = txs > 0 || unconfirmedTxs > 0
      if (!addressData.used && used && page === 1) {
        addressData.used = true
      }

      // Process and save the address's transactions
      for (const txResponse of transactions) {
        const tx = processTransactionResponse({ ...args, txResponse })
        const processedTx = await dataLayer.saveTransaction({
          tx,
          scriptPubkeys: [scriptPubkey]
        })
        await transactionChanged({
          walletId: walletInfo.id,
          emitter,
          walletTools,
          dataLayer,
          pluginInfo,
          tx: processedTx
        })

        if (needsTxSpecific) {
          // Add task to grab transactionSpecific payload
          taskCache.updateTransactionSpecificCache[tx.txid] = {
            processing: false
          }
        }
      }

      // Halt on finishing the processing of address transaction until
      // we have progressed through all of the blockbook pages
      if (page < totalPages) {
        // Add the address back to the cache, incrementing the page
        addressTransactionCache[address] = {
          ...addressTransactionState,
          processing: false,
          page: page + 1
        }
        return
      }

      // Update the lastQueriedBlockHeight for the address
      addressData.lastQueriedBlockHeight = blockHeight

      // Save/update the fully-processed address
      await dataLayer.saveAddress(addressData)

      // Update the progress now that the transactions for an address have processed
      await args.updateProgressRatio()

      // Call setLookAhead to update the lookahead
      await setLookAhead(args)
    })
    .catch(err => {
      // Log the error for debugging purposes without crashing the engine
      // This will cause frozen wallet syncs
      console.error(err)
      addressTransactionCache[address] = addressTransactionState
    })

  return args.serverStates.addressQueryTask(
    serverUri,
    address,
    {
      lastQueriedBlockHeight: addressData.lastQueriedBlockHeight,
      page
    },
    deferred
  )
}

interface processTransactionResponseArgs extends CommonArgs {
  txResponse: TransactionResponse
}

const processTransactionResponse = (
  args: processTransactionResponseArgs
): TransactionData => {
  const {
    txResponse,
    pluginInfo: { coinInfo }
  } = args
  const inputs = txResponse.vin.map(vin => {
    const scriptPubkey =
      // Note: Blockbook has empirically not sent a hex value as the
      // scriptPubkey for vins. If we discover this to be changed for some
      // cases, we may want to use the `hex` field as an optimization.
      asMaybe(
        raw => validScriptPubkeyFromAddress(raw),
        'unknown'
      )({
        address: vin.addresses[0],
        coin: coinInfo.name
      })
    return {
      txId: vin.txid,
      outputIndex: vin.vout,
      n: vin.n,
      scriptPubkey,
      sequence: vin.sequence,
      amount: vin.value
    }
  })
  const outputs = txResponse.vout.map(vout => {
    const scriptPubkey =
      vout.hex ??
      asMaybe(
        raw => validScriptPubkeyFromAddress(raw),
        'unknown'
      )({
        address: vout.addresses[0],
        coin: coinInfo.name
      })
    return {
      n: vout.n,
      scriptPubkey,
      amount: vout.value
    }
  })
  return {
    txid: txResponse.txid,
    hex: txResponse.hex,
    // Blockbook can return a blockHeight of -1 when the tx is pending in the mempool
    blockHeight: txResponse.blockHeight > 0 ? txResponse.blockHeight : 0,
    date: txResponse.blockTime,
    fees: txResponse.fees,
    inputs,
    outputs,
    ourIns: [],
    ourOuts: [],
    ourAmount: '0'
  }
}

interface ProcessAddressUtxosArgs extends CommonArgs {
  address: string
  path: ChangePath
  processing: boolean
  serverUri: string
}

const processAddressUtxos = async (
  args: ProcessAddressUtxosArgs
): Promise<WsTask<AddressUtxosResponse>> => {
  const {
    address,
    walletTools,
    dataLayer,
    taskCache,
    path,
    pluginState,
    serverUri
  } = args
  const { addressUtxoCache, rawUtxoCache, dataLayerUtxoCache } = taskCache
  const queryTime = Date.now()
  const deferred = new Deferred<AddressUtxosResponse>()
  deferred.promise
    .then(async (utxos: AddressUtxosResponse) => {
      pluginState.serverScoreUp(serverUri, Date.now() - queryTime)
      const scriptPubkey = walletTools.addressToScriptPubkey(address)
      const addressData = await dataLayer.fetchAddress(scriptPubkey)
      if (addressData == null || addressData.path == null) {
        return
      }

      if (utxos.length === 0) {
        addToDataLayerUtxoCache(dataLayerUtxoCache, path, scriptPubkey, 0)
        return
      }

      for (const utxo of utxos) {
        const utxoId = `${utxo.txid}_${utxo.vout}`
        rawUtxoCache[utxoId] = {
          blockbookUtxo: utxo,
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

  return args.serverStates.utxoListQueryTask(serverUri, address, deferred)
}

interface ProcessDataLayerUtxosArgs extends CommonArgs {
  scriptPubkey: string
  utxos: UtxoData[]
}

const processDataLayerUtxos = async (
  args: ProcessDataLayerUtxosArgs
): Promise<void> => {
  const {
    utxos,
    dataLayer,
    scriptPubkey,
    log,
    emitter,
    pluginInfo: { currencyInfo }
  } = args

  const updatedUtxos: { [utxoId: string]: UtxoData } = Object.fromEntries(
    [...utxos].map(utxo => [utxo.id, utxo])
  )
  const utxoIdsToRemove: string[] = []
  const currentUtxos = await dataLayer.fetchUtxos({ scriptPubkey })

  //
  // Modify existing UTXO set
  //

  let oldBalance = '0'
  for (const utxo of currentUtxos) {
    if (utxo == null)
      throw new Error(
        'Unexpected undefined utxo when processing unspent transactions'
      )
    if (!utxo.spent) {
      // Accumulate over the current address balance
      oldBalance = add(utxo.value, oldBalance)
    }

    // If the UTXO isn't present in the update UTXO set, then it is spent or dropped.
    // Remove it from the database if so
    if (updatedUtxos[utxo.id] == null) {
      utxoIdsToRemove.push(utxo.id)
    }
  }

  // Remove any spent UTXOs that have confirmations
  await dataLayer.removeUtxos(utxoIdsToRemove)

  //
  // Save updated UTXO set
  //

  let newBalance = '0'
  for (const utxo of Object.values(updatedUtxos)) {
    if (!utxo.spent) {
      // Accumulate over the new address balance
      newBalance = add(utxo.value, newBalance)
    }
    // Save new UTXOs
    await dataLayer.saveUtxo(utxo)
  }

  //
  // Balance update
  //

  // Address balance and emit address balance change event
  if (newBalance !== oldBalance) {
    log('address balance changed:', { scriptPubkey, oldBalance, newBalance })
    emitter.emit(
      EngineEvent.ADDRESS_BALANCE_CHANGED,
      currencyInfo.currencyCode,
      [
        {
          scriptPubkey,
          balance: newBalance
        }
      ]
    )

    // Update balances for address that have this scriptPubkey
    const address = await dataLayer.fetchAddress(scriptPubkey)

    if (address == null) {
      throw new Error('address not found when processing UTXO transactions')
    }

    await dataLayer.saveAddress({
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
  address: AddressData
  path: ChangePath
  id: string
  requiredCount: number
  serverUri: string
  utxo: BlockbookAccountUtxo
}

const processRawUtxo = async (
  args: ProcessRawUtxoArgs
): Promise<WsTask<TransactionResponse> | undefined> => {
  const {
    utxo,
    id,
    address,
    pluginInfo,
    dataLayer,
    path,
    taskCache,
    requiredCount,
    pluginState,
    serverUri,
    log
  } = args
  const { rawUtxoCache, dataLayerUtxoCache } = taskCache
  const purposeType = pathToPurposeType(
    path,
    pluginInfo.engineInfo.scriptTemplates
  )
  const scriptType: ScriptTypeEnum = getScriptTypeFromPurposeType(purposeType)
  let script: string
  let redeemScript: string | undefined

  // Function to call once we are finished
  const done = (): void => {
    const utxoData: UtxoData = {
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
    addToDataLayerUtxoCache(
      dataLayerUtxoCache,
      path,
      address.scriptPubkey,
      requiredCount,
      utxoData
    )
  }

  switch (purposeType) {
    case BIP43PurposeTypeEnum.Airbitz:
    case BIP43PurposeTypeEnum.Legacy:
    case BIP43PurposeTypeEnum.ReplayProtection:
      redeemScript = address.redeemScript

      // Legacy UTXOs need the previous transaction hex as the script
      // If we do not currently have it, add it to the queue to fetch it
      {
        const [tx] = await dataLayer.fetchTransactions({
          txId: utxo.txid
        })
        if (tx == null) {
          const queryTime = Date.now()
          const deferred = new Deferred<TransactionResponse>()
          deferred.promise
            .then((txResponse: TransactionResponse) => {
              pluginState.serverScoreUp(serverUri, Date.now() - queryTime)
              const processedTx = processTransactionResponse({
                ...args,
                txResponse
              })
              script = processedTx.hex
              // Only after we have successfully fetched the tx, set our script and call done
              done()
            })
            .catch(err => {
              // If something went wrong, add the UTXO back to the queue
              log('error in processRawUtxo:', err)
              const utxoId = `${utxo.txid}_${utxo.vout}`
              rawUtxoCache[utxoId] = {
                blockbookUtxo: utxo,
                processing: false,
                path,
                address,
                requiredCount
              }
            })

          return args.serverStates.transactionQueryTask(
            serverUri,
            utxo.txid,
            deferred
          )
        } else {
          script = tx.hex
        }
      }

      break
    case BIP43PurposeTypeEnum.WrappedSegwit:
      script = address.scriptPubkey
      if (address.redeemScript == null) {
        throw new Error(
          'Address redeem script not defined, but required for p2sh wrapped segwit utxo processing'
        )
      }
      redeemScript = address.redeemScript

      break
    case BIP43PurposeTypeEnum.Segwit:
      script = address.scriptPubkey

      break
  }

  // Since we have everything, call done
  done()
}

const addToDataLayerUtxoCache = (
  dataLayerUtxoCache: DataLayerUtxoCache,
  path: ChangePath,
  scriptPubkey: string,
  requiredCount: number,
  utxo?: UtxoData
): void => {
  const dataLayerUtxos = dataLayerUtxoCache[scriptPubkey] ?? {
    utxos: [],
    processing: false,
    path,
    full: false
  }
  if (utxo != null) dataLayerUtxos.utxos.push(utxo)
  dataLayerUtxoCache[scriptPubkey] = dataLayerUtxos
  dataLayerUtxos.full = dataLayerUtxos.utxos.length >= requiredCount
}
