import * as bs from 'biggystring'
import { EdgeFreshAddress, EdgeWalletInfo } from 'edge-core-js'

import { EngineEmitter, EngineEvent } from '../../plugin/makeEngineEmitter'
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
  ITransactionDetailsPaginationResponse
} from '../network/BlockBook'
import {
  addressMessage,
  addressUtxosMessage,
  transactionMessage
} from '../network/BlockBookAPI'
import Deferred from '../network/Deferred'
import { WsTask } from '../network/Socket'
import { BLOCKBOOK_TXS_PER_PAGE, CACHE_THROTTLE } from './constants'
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
  start: () => Promise<void>

  stop: () => Promise<void>

  getFreshAddress: (branch?: number) => Promise<EdgeFreshAddress>

  addGapLimitAddresses: (addresses: string[]) => Promise<void>
}

export interface UtxoEngineStateConfig extends EngineConfig {
  walletTools: UTXOPluginWalletTools
  processor: Processor
  blockBook: BlockBook
}

export function makeUtxoEngineState(
  config: UtxoEngineStateConfig
): UtxoEngineState {
  const {
    network,
    currencyInfo,
    walletInfo,
    walletTools,
    options: { emitter },
    processor,
    blockBook
  } = config

  // const addressesToWatch = new Set<string>()
  const addressesToWatch: Map<string, ShortPath> = new Map<string, ShortPath>()
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
    console.log(percent)
    if (percent - processedPercent > CACHE_THROTTLE || percent === 1) {
      processedPercent = percent
      emitter.emit(EngineEvent.ADDRESSES_CHECKED, percent)
    }
  }

  const mutexor = makeMutexor()

  const commonArgs: CommonArgs = {
    network,
    currencyInfo,
    walletInfo,
    walletTools,
    processor,
    emitter,
    addressesToWatch,
    taskCache,
    onAddressChecked,
    mutexor
  }

  void run(commonArgs, setLookAhead)

  return {
    async start(): Promise<void> {
      processedCount = 0
      processedPercent = 0

      blockBook.onQueueSpace(async () => {
        return await pickNextTask({
          ...commonArgs,
          blockBook
        })
      })

      await run(commonArgs, setLookAhead)
      await run(commonArgs, processFormatAddresses)
    },

    async stop(): Promise<void> {
      // TODO: stop watching blocks
      // TODO: stop watching addresses
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
      for (const address of addresses) {
        await saveAddress({
          ...commonArgs,
          address,
          used: true
        })
      }
      await run(commonArgs, setLookAhead)
    }
  }
}

interface CommonArgs {
  network: NetworkEnum
  currencyInfo: EngineCurrencyInfo
  walletInfo: EdgeWalletInfo
  walletTools: UTXOPluginWalletTools
  processor: Processor
  emitter: EngineEmitter
  addressesToWatch: Map<string, ShortPath>
  taskCache: TaskCache
  onAddressChecked: () => void
  mutexor: Mutexor
}

const run = async (
  args: CommonArgs,
  executor: (args: FormatArgs) => unknown
): Promise<void> => {
  const formatsToProcess = getWalletSupportedFormats(args.walletInfo)
  for (const format of formatsToProcess) {
    const branches = getFormatSupportedBranches(format)
    for (const branch of branches) {
      await executor({
        ...args,
        format,
        branch
      })
    }
  }
}

interface ShortPath {
  format: CurrencyFormat
  branch: number
}
interface TaskCache {
  addressWatching: boolean
  blockWatching: boolean
  addressSubscribeCache: Map<string, ShortPath>
  utxosCache: Map<string, AddressUtxoCacheState>
  rawUtxosCache: Map<IAccountUTXO, RawUtxoCacheState>
  processedUtxosCache: Map<IAddress, ProcessedUtxoCacheState>
  transactionsCache: Map<string, AddressTransactionCacheState>
  updateTransactionsCache: Map<string, UpdateTransactionsCacheState>
}
interface UpdateTransactionsCacheState {
  fetching: boolean
}
interface AddressUtxoCacheState {
  fetching: boolean
  path: ShortPath
}
interface ProcessedUtxoCacheState {
  processing: boolean
  full: boolean
  utxos: Set<IUTXO>
  path: ShortPath
}
interface RawUtxoCacheState extends AddressUtxoCacheState {
  address: Required<IAddress>
  requiredCount: number
}
interface AddressTransactionCacheState extends AddressUtxoCacheState {
  page: number
  networkQueryVal: number
}

interface OnNewBlockArgs extends CommonArgs {
  blockBook: BlockBook
}

const onNewBlock = async (args: OnNewBlockArgs): Promise<void> => {
  const { processor, taskCache } = args

  const txIds = await processor.fetchTxIdsByBlockHeight(0)
  if (txIds === []) {
    return
  }
  for (const txId of txIds) {
    taskCache.updateTransactionsCache.set(txId, { fetching: false })
  }
}

interface FormatArgs extends CommonArgs, ShortPath {}

interface SetLookAheadArgs extends FormatArgs {}

const setLookAhead = async (args: SetLookAheadArgs): Promise<void> => {
  const {
    format,
    branch,
    currencyInfo,
    walletTools,
    processor,
    mutexor,
    taskCache
  } = args

  await mutexor(`setLookAhead-${format}-${branch}`).runExclusive(async () => {
    const partialPath: Omit<AddressPath, 'addressIndex'> = {
      format,
      changeIndex: branch
    }

    const getLastUsed = async (): Promise<number> =>
      await findLastUsedIndex({ ...args, ...partialPath })
    const getAddressCount = (): number =>
      processor.getNumAddressesFromPathPartition(partialPath)

    while ((await getLastUsed()) + currencyInfo.gapLimit > getAddressCount()) {
      const path: AddressPath = {
        ...partialPath,
        addressIndex: getAddressCount()
      }
      const { address } = walletTools.getAddress(path)
      await saveAddress({
        ...args,
        address,
        path
      })

      taskCache.addressSubscribeCache.set(address, { format, branch })
    }
  })
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
    fetching: false,
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
}

export const pickNextTask = async (
  args: NextTaskArgs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<WsTask<any> | undefined> => {
  const { addressesToWatch, taskCache, blockBook } = args

  const {
    addressSubscribeCache,
    utxosCache,
    rawUtxosCache,
    processedUtxosCache,
    transactionsCache,
    updateTransactionsCache
  } = taskCache

  console.log({
    addressSubscribeCache: addressSubscribeCache.size,
    utxosCache: utxosCache.size,
    rawUtxosCache: rawUtxosCache.size,
    processedUtxosCache: processedUtxosCache.size,
    transactionsCache: transactionsCache.size,
    updateTransactionsCache: updateTransactionsCache.size
  })

  // first check if blocks are already being watched
  if (!taskCache.blockWatching) {
    taskCache.blockWatching = true
    const deferred = new Deferred<unknown>()
    deferred.promise.catch(() => {
      taskCache.blockWatching = false
    })

    blockBook.watchBlocks(
      async () => await onNewBlock({ ...args, blockBook }),
      deferred
    )
  }

  // Loop to process addresses to utxos
  for (const [address, state] of utxosCache) {
    // Check if we need to fetch address UTXOs
    if (!state.fetching) {
      state.fetching = true

      utxosCache.delete(address)

      // Fetch and process address UTXOs
      const wsTask = await processAddressUtxos({
        ...args,
        ...state,
        address
      })
      return wsTask
    }
  }

  // Check if there are any addresses pending to be subscribed
  if (addressSubscribeCache.size > 0 && !taskCache.addressWatching) {
    // Loop each address that needs to be subscribed
    for (const [address, path] of addressSubscribeCache) {
      // Add address in the cache to the set of addresses to watch
      addressesToWatch.set(address, path)

      if (path != null) {
        // Add the newly watched addresses to the UTXO cache
        utxosCache.set(address, {
          fetching: false,
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
    }

    taskCache.addressWatching = true

    const deferred = new Deferred<unknown>()
    deferred.promise
      .then(() => {
        addressSubscribeCache.clear()
      })
      .catch(() => {
        taskCache.addressWatching = false
      })
    blockBook.watchAddresses(
      Array.from(addressesToWatch.keys()),
      (response: INewTransactionResponse) => {
        const path = addressesToWatch.get(response.address)
        if (path != null) {
          utxosCache.set(response.address, {
            fetching: false,
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
        }
      },
      deferred
    )
    return
  }

  // filled when transactions potentially changed (e.g. through new block notification)
  for (const [txId, state] of updateTransactionsCache) {
    if (!state.fetching) {
      state.fetching = true
      updateTransactionsCache.delete(txId)
      return updateTransactions({ ...args, txId })
    }
  }

  // Loop unparsed utxos, some require a network call to get the full tx data
  for (const [utxo, state] of rawUtxosCache) {
    if (!state.fetching) {
      state.fetching = true
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

  // loop to get and process transaction history of single addresses, triggers setLookAhead
  for (const [address, state] of transactionsCache) {
    if (!state.fetching) {
      state.fetching = true

      transactionsCache.delete(address)

      // Fetch and process address UTXOs
      const wsTask = await processAddressTransactions({
        ...args,
        ...state,
        address
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
  const deferred = new Deferred<ITransaction>()
  deferred.promise
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
      taskCache.updateTransactionsCache.set(txId, { fetching: false })
    })
  return {
    ...transactionMessage(txId),
    deferred
  }
}

interface SaveAddressArgs extends CommonArgs {
  address: string
  path?: AddressPath
  used?: boolean
}

const saveAddress = async (args: SaveAddressArgs): Promise<void> => {
  const { address, path, used = false, processor, walletTools, mutexor } = args

  const scriptPubkey = walletTools.addressToScriptPubkey(address)

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

  const path: AddressPath = {
    format,
    changeIndex: branch,
    addressIndex: 0 // tmp
  }
  const addressCount = await processor.getNumAddressesFromPathPartition(path)
  // Get the assumed last used index
  path.addressIndex = Math.max(addressCount - currencyInfo.gapLimit - 1, 0)

  for (let i = path.addressIndex; i < addressCount; i++) {
    const addressData = await fetchAddressDataByPath({ ...args, path })
    if (addressData.used) {
      path.addressIndex = i
    }
  }

  return path.addressIndex
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
  let scriptPubkey = await processor.fetchScriptPubkeyByPath(path)
  scriptPubkey =
    scriptPubkey ?? (await walletTools.getScriptPubkey(path)).scriptPubkey
  if (scriptPubkey == null) {
    throw new Error('Unknown address path')
  }
  return walletTools.scriptPubkeyToAddress({
    scriptPubkey,
    format
  })
}

interface ProcessFormatAddressesArgs extends FormatArgs {}

const processFormatAddresses = async (
  args: ProcessFormatAddressesArgs
): Promise<void> => {
  const branches = getFormatSupportedBranches(args.format)
  for (const branch of branches) {
    await processPathAddresses({ ...args, changeIndex: branch })
  }
}

interface ProcessPathAddressesArgs extends ProcessFormatAddressesArgs {
  changeIndex: number
}

const processPathAddresses = async (
  args: ProcessPathAddressesArgs
): Promise<void> => {
  const {
    walletTools,
    processor,
    format,
    branch,
    changeIndex,
    taskCache
  } = args

  const addressCount = await processor.getNumAddressesFromPathPartition({
    format,
    changeIndex
  })
  for (let i = 0; i < addressCount; i++) {
    const path: AddressPath = {
      format,
      changeIndex,
      addressIndex: i
    }
    console.log('processing path', path)
    let scriptPubkey = await processor.fetchScriptPubkeyByPath(path)
    scriptPubkey =
      scriptPubkey ?? walletTools.getScriptPubkey(path).scriptPubkey
    const { address } = walletTools.scriptPubkeyToAddress({
      scriptPubkey,
      format
    })
    taskCache.addressSubscribeCache.set(address, { format, branch })
    taskCache.addressWatching = false
  }
}

interface ProcessAddressTxsArgs
  extends AddressTransactionCacheState,
    CommonArgs {
  address: string
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
    taskCache
  } = args
  const transactionsCache = taskCache.transactionsCache

  const scriptPubkey = walletTools.addressToScriptPubkey(address)
  const addressData = await processor.fetchAddressByScriptPubkey(scriptPubkey)

  const deferred = new Deferred<addressResponse>()
  deferred.promise
    .then(async (value: addressResponse) => {
      const { transactions = [], txs, unconfirmedTxs, totalPages } = value

      // If address is used and previously not marked as used, mark as used.
      const used = txs > 0 || unconfirmedTxs > 0
      if (used && !(addressData?.used ?? false) && page === 1) {
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
          fetching: false,
          page: page + 1
        })
      } else {
        // Callback for when an address has been fully processed
        args.onAddressChecked()

        await setLookAhead({ ...args, ...path })
      }
    })
    .catch(() => {
      args.fetching = false
      transactionsCache.set(address, {
        path,
        networkQueryVal,
        fetching: args.fetching,
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
    deferred
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

interface ProcessAddressUtxosArgs extends AddressUtxoCacheState, CommonArgs {
  address: string
}

const processAddressUtxos = async (
  args: ProcessAddressUtxosArgs
): Promise<WsTask<IAccountUTXO[]>> => {
  const { address, walletTools, processor, taskCache, path } = args
  const { utxosCache, rawUtxosCache } = taskCache
  const deferred = new Deferred<IAccountUTXO[]>()
  deferred.promise
    .then(async (utxos: IAccountUTXO[]) => {
      const scriptPubkey = walletTools.addressToScriptPubkey(address)
      const addressData = await processor.fetchAddressByScriptPubkey(
        scriptPubkey
      )
      if (addressData == null || addressData.path == null) {
        return
      }
      for (const utxo of utxos) {
        rawUtxosCache.set(utxo, {
          fetching: false,
          requiredCount: utxos.length,
          path,
          // TypeScript yells otherwise
          address: { ...addressData, path: addressData.path }
        })
      }
    })
    .catch(() => {
      args.fetching = false
      utxosCache.set(address, {
        fetching: args.fetching,
        path
      })
    })
  return {
    ...addressUtxosMessage(address),
    deferred
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
  const { address, utxos, currencyInfo, processor, emitter, mutexor } = args

  await mutexor(`utxos-${address.scriptPubkey}`).runExclusive(async () => {
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
      console.log({ address, diff })
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
  })
}

interface ProcessRawUtxoArgs extends FormatArgs, RawUtxoCacheState {
  utxo: IAccountUTXO
  id: string
  address: Required<IAddress>
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
    requiredCount
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
        const deferred = new Deferred<ITransaction>()
        deferred.promise
          .then((rawTx: ITransaction) => {
            const processedTx = processRawTx({ ...args, tx: rawTx })
            script = processedTx.hex
            // Only after we have successfully fetched the tx, set our script and call done
            done()
          })
          .catch(() => {
            // If something went wrong, add the UTXO back to the queue
            rawUtxosCache.set(utxo, {
              fetching: false,
              path,
              address,
              requiredCount
            })
          })
        return {
          ...transactionMessage(utxo.txid),
          deferred
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
