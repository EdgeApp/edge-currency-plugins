import { add } from 'biggystring'
import { asMaybe } from 'cleaners'
import {
  EdgeFreshAddress,
  EdgeIo,
  EdgeLog,
  EdgeTransaction
} from 'edge-core-js/types'

import { EngineEmitter, EngineEvent } from '../../plugin/EngineEmitter'
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
import { WsTask, WsTaskAsyncGenerator } from '../network/Socket'
import AwaitLock from './await-lock'
import { CACHE_THROTTLE } from './constants'
import { makeServerStates, ServerState, ServerStates } from './ServerStates'
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
  dataLayer: DataLayer
  seenTxCheckpoint: (value?: string) => string | undefined
  walletTools: UtxoWalletTools
  walletInfo: SafeWalletInfo
}

export function makeUtxoEngineProcessor(
  config: UtxoEngineProcessorConfig
): UtxoEngineProcessor {
  const {
    dataLayer,
    initOptions,
    io,
    emitter,
    engineOptions,
    pluginState,
    pluginInfo,
    seenTxCheckpoint,
    walletInfo,
    walletTools
  } = config
  const { log } = engineOptions

  const { walletFormats } = walletInfo.keys

  const taskCache: TaskCache = {
    addressForTransactionsCache: {},
    addressForUtxosCache: {},
    addressSubscribeCache: {},
    blockbookUtxoCache: {},
    dataLayerUtxoCache: {},
    transactionSpecificUpdateCache: {},
    transactionUpdateCache: {}
  }

  const clearTaskCache = (): void => {
    for (const key of Object.keys(taskCache.addressForTransactionsCache)) {
      removeItem(taskCache.addressForTransactionsCache, key)
    }
    for (const key of Object.keys(taskCache.addressForUtxosCache)) {
      removeItem(taskCache.addressForUtxosCache, key)
    }
    for (const key of Object.keys(taskCache.addressSubscribeCache)) {
      removeItem(taskCache.addressSubscribeCache, key)
    }
    for (const key of Object.keys(taskCache.blockbookUtxoCache)) {
      removeItem(taskCache.blockbookUtxoCache, key)
    }
    for (const key of Object.keys(taskCache.dataLayerUtxoCache)) {
      removeItem(taskCache.dataLayerUtxoCache, key)
    }
    for (const key of Object.keys(taskCache.transactionSpecificUpdateCache)) {
      removeItem(taskCache.transactionSpecificUpdateCache, key)
    }
    for (const key of Object.keys(taskCache.transactionUpdateCache)) {
      removeItem(taskCache.transactionUpdateCache, key)
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

  const updateSeenTxCheckpoint = (): void => {
    // Only update the seenTxCheckpoint if the wallet is fully synced.
    // This ensure that initial syncs without a defined seenTxCheckpoint,
    // will not incorrectly update the seenTxCheckpoint in the middle of an
    // initial sync.
    if (processedPercent < 1) return

    const seenTxCheckpoint = common.seenTxCheckpoint()
    const seenTxBlockHeight =
      seenTxCheckpoint != null ? parseInt(seenTxCheckpoint) : undefined

    // Update the seenTxCheckpoint
    if (
      seenTxBlockHeight == null ||
      common.maxSeenTxBlockHeight > seenTxBlockHeight
    ) {
      const newSeenTxCheckpoint = common.maxSeenTxBlockHeight.toString()
      common.emitter.emit(EngineEvent.SEEN_TX_CHECKPOINT, newSeenTxCheckpoint)
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
  const common: CommonParams = {
    pluginInfo,
    walletInfo,
    walletTools,
    dataLayer,
    emitter,
    taskCache,
    updateProgressRatio,
    updateSeenTxCheckpoint,
    io,
    log,
    maxSeenTxBlockHeight: 0,
    seenTxCheckpoint,
    serverStates,
    walletFormats,
    lock
  }

  serverStates.setPickNextTaskCB(serverUri => {
    return pickNextTask(common, serverUri)
  })

  let running = false
  const run = async (): Promise<void> => {
    if (running) return
    running = true

    await initializeAddressSubscriptions()
    await setLookAhead(common)
  }

  emitter.on(
    EngineEvent.BLOCK_HEIGHT_CHANGED,
    async (_uri: string, _blockHeight: number): Promise<void> => {
      // Add all unconfirmed transactions to the cache to check if these
      // transactions have been confirmed:
      const txs = await dataLayer.fetchTransactions({
        blockHeight: 0
      })
      for (const tx of txs) {
        if (tx == null) continue
        taskCache.transactionUpdateCache[tx.txid] = {
          processing: false
        }
      }
    }
  )

  emitter.on(
    EngineEvent.NEW_ADDRESS_TRANSACTION,
    async (_uri: string, response: SubscribeAddressResponse): Promise<void> => {
      const state = taskCache.addressSubscribeCache[response.address]
      if (state != null) {
        const { path } = state
        taskCache.addressForUtxosCache[response.address] = {
          processing: false,
          path
        }
        addToAddressForTransactionsCache(common, {
          address: response.address,
          changePath: path,
          blockHeight: 0,
          addressForTransactionsCache: taskCache.addressForTransactionsCache
        }).catch(() => {
          throw new Error('failed to add to transaction cache')
        })
        setLookAhead(common).catch(e => {
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
        addToAddressSubscribeCache(common.taskCache, addressesToSubscribe, {
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
      } = await internalGetFreshAddress(common, {
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
          } = await internalGetFreshAddress(common, {
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
        walletTools: common.walletTools,
        engineInfo: common.pluginInfo.engineInfo,
        dataLayer: common.dataLayer,
        taskCache: common.taskCache,
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

        await processDataLayerUtxos(common, {
          scriptPubkey,
          utxos: combinedUtxos
        })
      }
    }
  }
}

const internalDeriveScriptAddress = async (args: {
  walletTools: UtxoWalletTools
  engineInfo: EngineInfo
  dataLayer: DataLayer
  format: CurrencyFormat
  taskCache: TaskCache
  script: string
}): Promise<{
  address: string
  scriptPubkey: string
  redeemScript: string
}> => {
  const { walletTools, engineInfo, dataLayer, format, taskCache, script } = args
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

const internalGetFreshAddress = async (
  common: CommonParams,
  args: {
    forceIndex?: number
    changePath: ChangePath
  }
): Promise<{
  address: string
  legacyAddress: string
  nativeBalance?: string
}> => {
  const { changePath, forceIndex } = args

  const numAddresses = common.dataLayer.numAddressesByFormatPath(changePath)

  const path: AddressPath = {
    format: changePath.format,
    changeIndex: changePath.changeIndex,
    // while syncing, we may hit negative numbers when only subtracting. Use the address at /0 in that case.
    addressIndex: Math.max(
      numAddresses - common.pluginInfo.engineInfo.gapLimit,
      0
    )
  }
  if (forceIndex != null) {
    path.addressIndex = forceIndex
  }

  const iAddress = await common.dataLayer.fetchAddress(path)
  const nativeBalance = iAddress?.balance ?? '0'
  const { scriptPubkey } =
    iAddress ?? (await common.walletTools.getScriptPubkey(path))

  if (scriptPubkey == null) {
    throw new Error('Unknown address path')
  }
  const address = common.walletTools.scriptPubkeyToAddress({
    changePath: path,
    scriptPubkey
  })

  return {
    ...address,
    nativeBalance
  }
}
interface CommonParams {
  pluginInfo: PluginInfo
  walletInfo: SafeWalletInfo
  walletTools: UtxoWalletTools
  dataLayer: DataLayer
  emitter: EngineEmitter
  taskCache: TaskCache
  updateProgressRatio: () => void
  updateSeenTxCheckpoint: () => void
  io: EdgeIo
  log: EdgeLog
  maxSeenTxBlockHeight: number
  seenTxCheckpoint: (value?: string) => string | undefined
  serverStates: ServerStates
  walletFormats: CurrencyFormat[]
  lock: AwaitLock
}

interface TaskCache {
  readonly addressForTransactionsCache: AddressForTransactionsCache
  readonly addressForUtxosCache: AddressForUtxosCache
  readonly addressSubscribeCache: AddressSubscribeCache
  readonly blockbookUtxoCache: BlockbookUtxoCache
  readonly dataLayerUtxoCache: DataLayerUtxoCache
  readonly transactionSpecificUpdateCache: TransactionSpecificUpdateCache
  readonly transactionUpdateCache: TransactionUpdateCache
}

interface AddressForTransactionsCache {
  [key: string]: {
    processing: boolean
    path: ChangePath
    page: number
    blockHeight: number
  }
}
interface AddressForUtxosCache {
  [key: string]: { processing: boolean; path: ChangePath }
}
interface AddressSubscribeCache {
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
interface BlockbookUtxoCache {
  [key: string]: {
    blockbookUtxo: BlockbookAccountUtxo
    processing: boolean
    path: ChangePath
    address: AddressData
    requiredCount: number
  }
}
interface TransactionSpecificUpdateCache {
  [key: string]: { processing: boolean }
}
interface TransactionUpdateCache {
  [key: string]: { processing: boolean }
}

const setLookAhead = async (common: CommonParams): Promise<void> => {
  // Wait for the lock to be released before continuing invocation.
  // This is to ensure that setLockAhead is not called while the lock is held.
  await common.lock.acquireAsync()

  try {
    for (const format of common.walletFormats) {
      const branches = getFormatSupportedBranches(
        common.pluginInfo.engineInfo,
        format
      )
      for (const branch of branches) {
        await deriveKeys({ format, changeIndex: branch })
      }
    }
  } finally {
    common.lock.release()
  }

  async function deriveKeys(changePath: ChangePath): Promise<void> {
    const addressesToSubscribe = new Set<string>()
    const totalAddressCount = common.dataLayer.numAddressesByFormatPath(
      changePath
    )
    let lastUsedIndex = await common.dataLayer.lastUsedIndexByFormatPath(
      changePath
    )

    // Loop until the total address count equals the lookahead count
    let lookAheadIndex = lastUsedIndex + common.pluginInfo.engineInfo.gapLimit
    let nextAddressIndex = totalAddressCount
    while (nextAddressIndex <= lookAheadIndex) {
      const path: AddressPath = {
        ...changePath,
        addressIndex: nextAddressIndex
      }

      const { scriptPubkey, redeemScript } = common.walletTools.getScriptPubkey(
        path
      )
      const { address } = common.walletTools.scriptPubkeyToAddress({
        changePath: path,
        scriptPubkey
      })

      // Make a new IAddress and save it
      await common.dataLayer.saveAddress(
        makeAddressData({ scriptPubkey, redeemScript, path })
      )

      // Add the displayAddress to the set of addresses to subscribe to after loop
      addressesToSubscribe.add(address)

      // Update the state for the loop
      lastUsedIndex = await common.dataLayer.lastUsedIndexByFormatPath(
        changePath
      )
      lookAheadIndex = lastUsedIndex + common.pluginInfo.engineInfo.gapLimit
      nextAddressIndex = common.dataLayer.numAddressesByFormatPath(changePath)
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

const addToAddressForTransactionsCache = async (
  common: CommonParams,
  args: {
    address: string
    changePath: ChangePath
    blockHeight: number
    addressForTransactionsCache: AddressForTransactionsCache
  }
): Promise<void> => {
  const { address, changePath, addressForTransactionsCache } = args
  let { blockHeight } = args
  // Fetch the blockHeight for the address from the database
  const scriptPubkey = common.walletTools.addressToScriptPubkey(address)

  if (blockHeight === 0) {
    const { lastQueriedBlockHeight = 0 } =
      (await common.dataLayer.fetchAddress(scriptPubkey)) ?? {}
    blockHeight = lastQueriedBlockHeight
  }

  addressForTransactionsCache[address] = {
    processing: false,
    path: changePath,
    page: 1, // Page starts on 1
    blockHeight
  }
}

/**
 * Some currencies require an additional blockbook payload 'getTransactionSpecific' in order
 * to provide all relevant transaction data. Since this is currency-specific, we can limit
 * the usage to currencies that require it.
 **/
const needsTxSpecific = (common: CommonParams): boolean => {
  return common.pluginInfo.engineInfo.txSpecificHandling != null
}

/**
 * The pickNextTask generator is responsible for selecting the next WsTask
 * to be done by the network layer. It will yield WsTasks or booleans for early
 * exit, and it will return a boolean when it's done.
 */
type PickNextTaskGenerator = AsyncGenerator<
  boolean | WsTask<unknown>,
  boolean,
  // Expect only these responses from yielding:
  AddressUtxosResponse & AddressResponse & TransactionResponse
>

export async function* pickNextTask(
  common: CommonParams,
  serverUri: string
): PickNextTaskGenerator {
  const {
    addressForTransactionsCache,
    addressForUtxosCache,
    addressSubscribeCache,
    blockbookUtxoCache,
    dataLayerUtxoCache,
    transactionSpecificUpdateCache,
    transactionUpdateCache
  } = common.taskCache

  const serverState = common.serverStates.getServerState(serverUri)
  if (serverState == null) return false

  // subscribe all servers to new blocks
  if (serverState.blockSubscriptionStatus === 'unsubscribed') {
    common.serverStates.watchBlocks(serverUri)
    return true
  }

  // Loop processed utxos, these are just database ops, triggers setLookAhead
  if (Object.keys(dataLayerUtxoCache).length > 0) {
    for (const [scriptPubkey, cacheItem] of Object.entries(
      dataLayerUtxoCache
    )) {
      // Only process when all utxos for a specific address have been gathered
      if (!cacheItem.processing && cacheItem.full) {
        cacheItem.processing = true
        await processDataLayerUtxos(common, {
          scriptPubkey,
          utxos: cacheItem.utxos
        })
        removeItem(dataLayerUtxoCache, scriptPubkey)
        return true
      }
    }
  }

  // Loop unparsed utxos, some require a network call to get the full tx data
  for (const [utxoId, cacheItem] of Object.entries(blockbookUtxoCache)) {
    const utxo = cacheItem.blockbookUtxo
    if (!cacheItem.processing) {
      // check if we need to fetch additional network content for legacy purpose type
      const purposeType = pathToPurposeType(
        cacheItem.path,
        common.pluginInfo.engineInfo.scriptTemplates
      )
      if (
        purposeType === BIP43PurposeTypeEnum.Airbitz ||
        purposeType === BIP43PurposeTypeEnum.Legacy ||
        purposeType === BIP43PurposeTypeEnum.ReplayProtection
      ) {
        // if we do need to make a network call, check with the serverState
        if (!common.serverStates.serverCanGetTx(serverUri, utxo.txid))
          return false
      }
      cacheItem.processing = true
      removeItem(blockbookUtxoCache, utxoId)
      yield* processBlockbookUtxo(common, {
        serverUri,
        cacheItem
      })
    }
  }

  // Loop to process addresses to utxos
  for (const [address, cacheItem] of Object.entries(addressForUtxosCache)) {
    // Check if we need to fetch address UTXOs
    if (
      !cacheItem.processing &&
      common.serverStates.serverCanGetAddress(serverUri, address)
    ) {
      cacheItem.processing = true

      removeItem(addressForUtxosCache, address)

      // Fetch and process address for UTXOs
      yield* processAddressForUtxos(common, {
        address,
        cacheItem,
        serverState,
        serverUri
      })
    }
  }

  // Check if there are any addresses pending to be subscribed
  if (Object.keys(addressSubscribeCache).length > 0) {
    // These are addresses to which the server has not subscribed
    const newAddresses: string[] = []
    const blockHeight = common.serverStates.getBlockHeight(serverUri)

    // Loop each address in the cache
    for (const [address, cacheItem] of Object.entries(addressSubscribeCache)) {
      const isAddressNewlySubscribed = !common.serverStates.serverIsAwareOfAddress(
        serverUri,
        address
      )

      // Add address in the cache to the set of addresses to watch
      if (isAddressNewlySubscribed) {
        newAddresses.push(address)
      }

      // Add to the addressForTransactionsCache if they're not yet added:
      // Only process newly watched addresses
      if (cacheItem.processing) continue

      // Add the newly watched addresses to the UTXO cache
      if (isAddressNewlySubscribed) {
        addressForUtxosCache[address] = {
          processing: false,
          path: cacheItem.path
        }
      }

      await addToAddressForTransactionsCache(common, {
        address,
        changePath: cacheItem.path,
        blockHeight,
        addressForTransactionsCache
      })
      cacheItem.processing = true
    }

    // Subscribe to any new addresses
    if (newAddresses.length > 0) {
      common.serverStates.watchAddresses(serverUri, newAddresses)
      return true
    }
  }

  // filled when transactions potentially changed (e.g. through new block notification)
  if (Object.keys(transactionSpecificUpdateCache).length > 0) {
    let hasProcessedAtLeastOnce = false
    for (const [txId, cacheItem] of Object.entries(
      transactionSpecificUpdateCache
    )) {
      if (
        !cacheItem.processing &&
        common.serverStates.serverCanGetTx(serverUri, txId)
      ) {
        hasProcessedAtLeastOnce = true
        cacheItem.processing = true
        removeItem(transactionSpecificUpdateCache, txId)
        yield* processTransactionsSpecificUpdate(common, {
          serverState,
          serverUri,
          txId
        })
      }
    }
    // This condition prevents infinite loops
    if (hasProcessedAtLeastOnce) return true
  }

  // filled when transactions potentially changed (e.g. through new block notification)
  if (Object.keys(transactionUpdateCache).length > 0) {
    let hasProcessedAtLeastOnce = false
    for (const [txId, cacheItem] of Object.entries(transactionUpdateCache)) {
      if (
        !cacheItem.processing &&
        common.serverStates.serverCanGetTx(serverUri, txId)
      ) {
        hasProcessedAtLeastOnce = true
        cacheItem.processing = true
        removeItem(transactionUpdateCache, txId)
        yield* processCheckTransactionConfirmation(common, {
          serverState,
          serverUri,
          txId
        })
      }
    }
    // This condition prevents infinite loops
    if (hasProcessedAtLeastOnce) return true
  }

  // loop to get and process transaction history of single addresses, triggers setLookAhead
  for (const [address, cacheItem] of Object.entries(
    addressForTransactionsCache
  )) {
    if (
      !cacheItem.processing &&
      common.serverStates.serverCanGetAddress(serverUri, address)
    ) {
      cacheItem.processing = true

      removeItem(addressForTransactionsCache, address)

      // Fetch and process address UTXOs
      yield* processAddressForTransactions(common, {
        address,
        cacheItem,
        serverState,
        serverUri
      })
    }
  }

  // Nothing to do
  return false
}

/**
 * Process a transaction specific update from the TransactionSpecificUpdateCache
 * by querying the network for the transaction data using the specific handling
 * query and processing the data into the DataLayer.
 */
async function* processTransactionsSpecificUpdate(
  common: CommonParams,
  args: {
    serverState: ServerState
    serverUri: string
    txId: string
  }
): WsTaskAsyncGenerator<unknown> {
  const { serverState, serverUri, txId } = args
  try {
    const txResponse: unknown = yield* common.serverStates.transactionSpecialQueryTask(
      serverUri,
      txId
    )
    // Grab tx to update it
    const txs = await common.dataLayer.fetchTransactions({ txId })
    let tx = txs[0]
    if (tx == null) return true

    if (common.pluginInfo.engineInfo.txSpecificHandling != null) {
      // Do coin-specific things to it
      tx = common.pluginInfo.engineInfo.txSpecificHandling(tx, txResponse)
    }

    // Process and save new tx
    const processedTx = await common.dataLayer.saveTransaction({
      tx
    })

    const edgeTx = await toEdgeTransaction({
      dataLayer: common.dataLayer,
      pluginInfo: common.pluginInfo,
      tx: processedTx,
      walletId: common.walletInfo.id,
      walletTools: common.walletTools
    })
    common.emitter.emit(EngineEvent.TRANSACTIONS, [
      { isNew: false, transaction: edgeTx }
    ])

    // Add the txid to the server cache
    serverState.txids.add(txId)

    return true
  } catch (err) {
    console.error(err)
    common.log('error while processing transaction specific update:', err)
    common.taskCache.transactionSpecificUpdateCache[txId] = {
      processing: false
    }
    return false
  }
}

/**
 * Processes an item from transactionUpdateCache by querying
 * the network for the transaction data and processing it into the DataLayer.
 * It updates the transaction and all of the transaction's UTXO with the
 * blockHeight received from the network.
 */
async function* processCheckTransactionConfirmation(
  common: CommonParams,
  args: {
    serverState: ServerState
    serverUri: string
    txId: string
  }
): WsTaskAsyncGenerator<TransactionResponse> {
  const { serverState, serverUri, txId } = args

  try {
    const txResponse: TransactionResponse = yield* common.serverStates.transactionQueryTask(
      serverUri,
      txId
    )
    // check if blockbook tx is still not confirmed, if so, don't change anything
    if (txResponse.blockHeight < 1) return false
    // Create new tx from raw tx
    const tx = processTransactionResponse(common, { txResponse })
    // Remove any existing input utxos from the dataLayer
    for (const input of tx.inputs) {
      await common.dataLayer.removeUtxos([`${input.txId}_${input.outputIndex}`])
    }
    // Update output utxos's blockHeight any existing input utxos from the dataLayer
    const utxoIds = tx.outputs.map(output => `${tx.txid}_${output.n}`)
    const utxos = await common.dataLayer.fetchUtxos({
      utxoIds
    })
    for (const utxo of utxos) {
      if (utxo == null) continue
      utxo.blockHeight = tx.blockHeight
      await common.dataLayer.saveUtxo(utxo)
    }
    // Process and save new tx
    const processedTx = await common.dataLayer.saveTransaction({
      tx
    })

    const edgeTx = await toEdgeTransaction({
      dataLayer: common.dataLayer,
      pluginInfo: common.pluginInfo,
      tx: processedTx,
      walletId: common.walletInfo.id,
      walletTools: common.walletTools
    })
    common.emitter.emit(EngineEvent.TRANSACTIONS, [
      { isNew: false, transaction: edgeTx }
    ])

    if (needsTxSpecific(common)) {
      // Add task to grab transactionSpecific payload
      common.taskCache.transactionSpecificUpdateCache[txId] = {
        processing: false
      }
    }

    // Add the txid to the server cache
    serverState.txids.add(txId)

    return true
  } catch (err) {
    console.error(err)
    common.log('error while processing transaction update:', err)
    common.taskCache.transactionUpdateCache[txId] = {
      processing: false
    }
    return false
  }
}

/**
 * Processes an address for transactions by querying the network for the
 * transaction data.
 */
async function* processAddressForTransactions(
  common: CommonParams,
  args: {
    address: string
    cacheItem: AddressForTransactionsCache[string]
    serverState: ServerState
    serverUri: string
  }
): WsTaskAsyncGenerator<AddressResponse> {
  const { address, cacheItem, serverState, serverUri } = args
  const { page = 1, blockHeight } = cacheItem
  const addressForTransactionsCache =
    common.taskCache.addressForTransactionsCache

  const scriptPubkey = common.walletTools.addressToScriptPubkey(address)
  const addressData = await common.dataLayer.fetchAddress(scriptPubkey)
  if (addressData == null) {
    throw new Error(`could not find address with script pubkey ${scriptPubkey}`)
  }

  try {
    const addressResponse = yield* common.serverStates.addressQueryTask(
      serverUri,
      address,
      {
        lastQueriedBlockHeight: addressData.lastQueriedBlockHeight,
        page
      }
    )
    const {
      transactions = [],
      txs,
      unconfirmedTxs,
      totalPages
    } = addressResponse

    // If address is used and previously not marked as used, mark as used.
    const used = txs > 0 || unconfirmedTxs > 0
    if (!addressData.used && used && page === 1) {
      addressData.used = true
    }

    const seenTxCheckpoint = common.seenTxCheckpoint()
    const seenTxBlockHeight =
      seenTxCheckpoint != null ? parseInt(seenTxCheckpoint) : undefined

    // Process and save the address's transactions
    for (const txResponse of transactions) {
      const [existingTx] = await common.dataLayer.fetchTransactions({
        txId: txResponse.txid
      })

      const tx = processTransactionResponse(common, { txResponse })
      const processedTx = await common.dataLayer.saveTransaction({
        tx,
        scriptPubkeys: [scriptPubkey]
      })
      const edgeTx = await toEdgeTransaction({
        dataLayer: common.dataLayer,
        pluginInfo: common.pluginInfo,
        tx: processedTx,
        walletId: common.walletInfo.id,
        walletTools: common.walletTools
      })

      // Keep track of transactions which are determined to be unseen:
      const isNew =
        seenTxBlockHeight != null &&
        // Unseen in the DataLayer
        existingTx == null &&
        // The tx unconfirmed or confirmed after/at the last seenTxCheckpoint
        (tx.blockHeight === 0 || tx.blockHeight > seenTxBlockHeight)

      common.emitter.emit(EngineEvent.TRANSACTIONS, [
        { isNew, transaction: edgeTx }
      ])

      if (edgeTx.blockHeight > common.maxSeenTxBlockHeight) {
        common.maxSeenTxBlockHeight = edgeTx.blockHeight
      }

      if (needsTxSpecific(common)) {
        // Add task to grab transactionSpecific payload
        common.taskCache.transactionSpecificUpdateCache[tx.txid] = {
          processing: false
        }
      }
    }

    // Make sure to update the seenTxCheckpoint after processing the transactions
    common.updateSeenTxCheckpoint()

    // Halt on finishing the processing of address transaction until
    // we have progressed through all of the blockbook pages
    if (page < totalPages) {
      // Add the address back to the cache, incrementing the page
      addressForTransactionsCache[address] = {
        ...cacheItem,
        processing: false,
        page: page + 1
      }
      return true
    }

    // Update the lastQueriedBlockHeight for the address
    addressData.lastQueriedBlockHeight = blockHeight

    // Save/update the fully-processed address
    await common.dataLayer.saveAddress(addressData)

    // Update the progress now that the transactions for an address have processed
    await common.updateProgressRatio()

    // Call setLookAhead to update the lookahead
    await setLookAhead(common)

    // Add the address to the server cache
    serverState.addresses.add(address)

    return true
  } catch (err) {
    // Log the error for debugging purposes without crashing the engine
    // This will cause frozen wallet syncs
    console.error(err)
    common.log('error while processing address for transactions:', err)
    addressForTransactionsCache[address] = { ...cacheItem, processing: false }
    return false
  }
}

/**
 * Processes a blockbook transaction response object (a blockbook transaction).
 * It will simply convert the blockbook transaction into a TransactionData
 * object to be saved in the DataLayer
 */
const processTransactionResponse = (
  common: CommonParams,
  args: { txResponse: TransactionResponse }
): TransactionData => {
  const { txResponse } = args

  let outputTotalValue = '0'
  const outputs: TransactionData['outputs'] = txResponse.vout.map(vout => {
    const scriptPubkey =
      vout.hex ??
      asMaybe(
        raw => validScriptPubkeyFromAddress(raw),
        'unknown'
      )({
        address: vout.addresses[0],
        coin: common.pluginInfo.coinInfo.name
      })
    outputTotalValue = add(outputTotalValue, vout.value)
    return {
      n: vout.n,
      scriptPubkey,
      amount: vout.value
    }
  })

  const inputs: TransactionData['inputs'] = txResponse.vin.map(vin => {
    // Handle coinbase input
    if (!vin.isAddress) {
      return {
        amount: outputTotalValue,
        n: 0,
        outputIndex: 4294967295,
        scriptPubkey: '', // Maybe there's a bogus scriptPubkey we can use here?
        sequence: vin.sequence,
        txId: '0000000000000000000000000000000000000000000000000000000000000000'
      }
    }

    const scriptPubkey =
      // Note: Blockbook has empirically not sent a hex value as the
      // scriptPubkey for vins. If we discover this to be changed for some
      // cases, we may want to use the `hex` field as an optimization.
      asMaybe(
        raw => validScriptPubkeyFromAddress(raw),
        'unknown'
      )({
        address: vin.addresses[0],
        coin: common.pluginInfo.coinInfo.name
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

/**
 * Process a given address for UTXO data by querying the network for UTXO data
 * and processing it into the `blockbookUtxoCache` to later be processed by
 * `processBlockbookUtxo`.
 */
async function* processAddressForUtxos(
  common: CommonParams,
  args: {
    address: string
    cacheItem: AddressForUtxosCache[string]
    serverState: ServerState
    serverUri: string
  }
): WsTaskAsyncGenerator<AddressUtxosResponse> {
  const { address, cacheItem, serverState, serverUri } = args
  const {
    addressForUtxosCache,
    blockbookUtxoCache,
    dataLayerUtxoCache
  } = common.taskCache
  try {
    const utxos: AddressUtxosResponse = yield* common.serverStates.utxoListQueryTask(
      serverUri,
      address
    )
    const scriptPubkey = common.walletTools.addressToScriptPubkey(address)
    const addressData = await common.dataLayer.fetchAddress(scriptPubkey)
    if (addressData == null || addressData.path == null) {
      return true
    }

    if (utxos.length === 0) {
      addToDataLayerUtxoCache(
        dataLayerUtxoCache,
        cacheItem.path,
        scriptPubkey,
        0
      )
      return true
    }

    for (const utxo of utxos) {
      const utxoId = `${utxo.txid}_${utxo.vout}`
      blockbookUtxoCache[utxoId] = {
        blockbookUtxo: utxo,
        processing: false,
        requiredCount: utxos.length,
        path: cacheItem.path,
        // TypeScript yells otherwise
        address: { ...addressData, path: addressData.path }
      }
    }

    serverState.addresses.add(address)

    return true
  } catch (err: unknown) {
    console.error(err)
    common.log('error while processing address for UTXOs:', err)
    addressForUtxosCache[address] = { ...cacheItem, processing: false }
    return false
  }
}

/**
 * Processes UtxoData from the DataLayerUtxoCache by saving/removing UTXOs
 * to/from the DataLayer and updating the address balance.
 */
const processDataLayerUtxos = async (
  common: CommonParams,
  args: {
    scriptPubkey: string
    utxos: UtxoData[]
  }
): Promise<void> => {
  const { utxos, scriptPubkey } = args

  const updatedUtxos: { [utxoId: string]: UtxoData } = Object.fromEntries(
    [...utxos].map(utxo => [utxo.id, utxo])
  )
  const utxoIdsToRemove: string[] = []
  const currentUtxos = await common.dataLayer.fetchUtxos({ scriptPubkey })

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
  await common.dataLayer.removeUtxos(utxoIdsToRemove)

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
    await common.dataLayer.saveUtxo(utxo)
  }

  //
  // Balance update
  //

  // Address balance and emit address balance change event
  if (newBalance !== oldBalance) {
    common.log('address balance changed:', {
      scriptPubkey,
      oldBalance,
      newBalance
    })
    common.emitter.emit(
      EngineEvent.ADDRESS_BALANCE_CHANGED,
      common.pluginInfo.currencyInfo.currencyCode,
      [
        {
          scriptPubkey,
          balance: newBalance
        }
      ]
    )

    // Update balances for address that have this scriptPubkey
    const address = await common.dataLayer.fetchAddress(scriptPubkey)

    if (address == null) {
      throw new Error('address not found when processing UTXO transactions')
    }

    await common.dataLayer.saveAddress({
      ...address,
      balance: newBalance,
      used: true
    })
  }

  // Update the progress now that the UTXOs for an address have been processed
  await common.updateProgressRatio()

  await setLookAhead(common).catch(err => {
    common.log.error(err)
    throw err
  })
}

/**
 * Process a blockbook UTXO from the cache by querying the network for
 * the UTXO's transaction data to get its script for legacy addresses.
 * After the network fetching, the UTXO is processed into a UtxoData object
 * to be later processed into the DataLayer.
 */
async function* processBlockbookUtxo(
  common: CommonParams,
  args: {
    serverUri: string
    cacheItem: BlockbookUtxoCache[string]
  }
): WsTaskAsyncGenerator<TransactionResponse> {
  const { serverUri, cacheItem } = args
  const { blockbookUtxoCache, dataLayerUtxoCache } = common.taskCache
  const purposeType = pathToPurposeType(
    cacheItem.path,
    common.pluginInfo.engineInfo.scriptTemplates
  )
  const scriptType: ScriptTypeEnum = getScriptTypeFromPurposeType(purposeType)
  let script: string
  let redeemScript: string | undefined

  // Function to call once we are finished
  const done = (): void => {
    const utxoData: UtxoData = {
      id: `${cacheItem.blockbookUtxo.txid}_${cacheItem.blockbookUtxo.vout}`,
      txid: cacheItem.blockbookUtxo.txid,
      vout: cacheItem.blockbookUtxo.vout,
      value: cacheItem.blockbookUtxo.value,
      scriptPubkey: cacheItem.address.scriptPubkey,
      script,
      redeemScript,
      scriptType,
      blockHeight: cacheItem.blockbookUtxo.height ?? -1,
      spent: false
    }
    addToDataLayerUtxoCache(
      dataLayerUtxoCache,
      cacheItem.path,
      cacheItem.address.scriptPubkey,
      cacheItem.requiredCount,
      utxoData
    )
  }

  switch (purposeType) {
    case BIP43PurposeTypeEnum.Airbitz:
    case BIP43PurposeTypeEnum.Legacy:
    case BIP43PurposeTypeEnum.ReplayProtection:
      redeemScript = cacheItem.address.redeemScript

      // Legacy UTXOs need the previous transaction hex as the script
      // If we do not currently have it, add it to the queue to fetch it
      {
        const [tx] = await common.dataLayer.fetchTransactions({
          txId: cacheItem.blockbookUtxo.txid
        })
        if (tx == null) {
          try {
            const txResponse: TransactionResponse = yield* common.serverStates.transactionQueryTask(
              serverUri,
              cacheItem.blockbookUtxo.txid
            )

            const processedTx = processTransactionResponse(common, {
              txResponse
            })
            script = processedTx.hex
            // Only after we have successfully fetched the tx, set our script and call done
            done()

            return true
          } catch (err) {
            // If something went wrong, add the UTXO back to the queue
            common.log('error while processing Blockbook UTXO:', err)
            const utxoId = `${cacheItem.blockbookUtxo.txid}_${cacheItem.blockbookUtxo.vout}`
            blockbookUtxoCache[utxoId] = {
              blockbookUtxo: cacheItem.blockbookUtxo,
              processing: false,
              path: cacheItem.path,
              address: cacheItem.address,
              requiredCount: cacheItem.requiredCount
            }
            return false
          }
        } else {
          script = tx.hex
        }
      }

      break
    case BIP43PurposeTypeEnum.WrappedSegwit:
      script = cacheItem.address.scriptPubkey
      if (cacheItem.address.redeemScript == null) {
        throw new Error(
          'Address redeem script not defined, but required for p2sh wrapped segwit utxo processing'
        )
      }
      redeemScript = cacheItem.address.redeemScript

      break
    case BIP43PurposeTypeEnum.Segwit:
      script = cacheItem.address.scriptPubkey

      break
  }

  // Since we have everything, call done
  done()

  return true
}

/**
 * This adds a UtxoData object to the DataLayerUtxoCache. It will mark the cache
 * with processing and full flags which tell the pickNextTask routine when to
 * process the UtxoData into the data-later.
 */
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
