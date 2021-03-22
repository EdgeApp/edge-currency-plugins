import * as bs from 'biggystring'
import { EdgeFreshAddress, EdgeWalletInfo } from 'edge-core-js'

import {
  AddressPath,
  CurrencyFormat,
  Emitter,
  EmitterEvent,
  EngineConfig,
  EngineCurrencyInfo,
  LocalWalletMetadata,
  NetworkEnum
} from '../../plugin/types'
import { Processor } from '../db/makeProcessor'
import { IAddress, IProcessorTransaction, IUTXO } from '../db/types'
import { BIP43PurposeTypeEnum, ScriptTypeEnum } from '../keymanager/keymanager'
import { BlockBook, ITransaction } from '../network/BlockBook'
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
  metadata: LocalWalletMetadata
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
    blockBook,
    metadata
  } = config

  const addressesToWatch = new Set<string>()

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
    if (percent - processedPercent > CACHE_THROTTLE || percent === 1) {
      processedPercent = percent
      emitter.emit(EmitterEvent.ADDRESSES_CHECKED, percent)
    }
  }

  const mutexor = makeMutexor()

  const commonArgs: CommonArgs = {
    network,
    currencyInfo,
    walletInfo,
    walletTools,
    processor,
    blockBook,
    metadata,
    emitter,
    addressesToWatch,
    onAddressChecked,
    mutexor
  }

  const run = async (): Promise<void> => {
    const formatsToProcess = getWalletSupportedFormats(walletInfo)
    for (const format of formatsToProcess) {
      const args: FormatArgs = {
        ...commonArgs,
        format
      }

      await setLookAhead(args)
    }
  }

  return {
    async start(): Promise<void> {
      processedCount = 0
      processedPercent = 0

      blockBook.watchBlocks(async () => await onNewBlock(commonArgs))

      await run()
    },

    async stop(): Promise<void> {},

    async getFreshAddress(branch = 0): Promise<EdgeFreshAddress> {
      const walletPurpose = getPurposeTypeFromKeys(walletInfo)
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
        if (walletPurpose !== BIP43PurposeTypeEnum.Airbitz) {
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

    async addGapLimitAddresses(addresses: string[]): Promise<void> {
      await Promise.all(
        addresses.map(async addr => {
          return await saveAddress({
            scriptPubkey: walletTools.addressToScriptPubkey(addr),
            used: true,
            processor
          })
        })
      )
      await run()
    }
  }
}

interface CommonArgs {
  network: NetworkEnum
  currencyInfo: EngineCurrencyInfo
  walletInfo: EdgeWalletInfo
  walletTools: UTXOPluginWalletTools
  processor: Processor
  blockBook: BlockBook
  emitter: Emitter
  addressesToWatch: Set<string>
  onAddressChecked: () => void
  metadata: LocalWalletMetadata
  mutexor: Mutexor
}

interface OnNewBlockArgs extends CommonArgs {}

const onNewBlock = async (args: OnNewBlockArgs): Promise<void> => {
  const { processor, blockBook } = args

  const txIds = await processor.fetchTxIdsByBlockHeight(0)
  if (txIds === []) {
    return
  }
  for (const txId of txIds) {
    const rawTx = await blockBook.fetchTransaction(txId)
    const tx = processRawTx({ ...args, tx: rawTx })
    // check if tx is still not confirmed, if so, don't change anything
    if (tx.blockHeight < 1) {
      return
    }
    await processor.removeTxIdByBlockHeight(0, txId)
    await processor.insertTxIdByBlockHeight(tx.blockHeight, txId)
    await processor.updateTransaction(txId, tx)
  }
}

interface FormatArgs extends CommonArgs {
  format: CurrencyFormat
}

interface SetLookAheadArgs extends FormatArgs {}

const setLookAhead = async (args: SetLookAheadArgs): Promise<void> => {
  const { format, currencyInfo, walletTools, processor, mutexor } = args

  await mutexor(`setLookAhead-${format}`).runExclusive(async () => {
    const branches = getFormatSupportedBranches(format)
    for (const branch of branches) {
      const partialPath: Omit<AddressPath, 'addressIndex'> = {
        format,
        changeIndex: branch
      }

      const getLastUsed = async (): Promise<number> =>
        await findLastUsedIndex({ ...args, ...partialPath })
      const getAddressCount = (): number =>
        processor.getNumAddressesFromPathPartition(partialPath)

      while (
        (await getLastUsed()) + currencyInfo.gapLimit >
        getAddressCount()
      ) {
        const path: AddressPath = {
          ...partialPath,
          addressIndex: getAddressCount()
        }
        const { address } = walletTools.getAddress(path)
        const scriptPubkey = walletTools.addressToScriptPubkey(address)
        const saveArgs: SaveAddressArgs = {
          ...args,
          scriptPubkey,
          path
        }
        await saveAddress(saveArgs).then(
          async () => await processAddress({ ...args, address })
        )
      }
    }
  })
}

interface SaveAddressArgs {
  scriptPubkey: string
  path?: AddressPath
  used?: boolean
  processor: Processor
}

const saveAddress = async (args: SaveAddressArgs, count = 0): Promise<void> => {
  const { scriptPubkey, path, used = false, processor } = args

  const saveNewAddress = async (): Promise<void> =>
    await processor.saveAddress({
      scriptPubkey,
      path,
      used,
      networkQueryVal: 0,
      lastQuery: 0,
      lastTouched: 0,
      balance: '0'
    })

  const addressData = await processor.fetchAddressByScriptPubkey(scriptPubkey)
  if (addressData == null) {
    await saveNewAddress()
  } else if (!addressData.used && used) {
    await processor.updateAddressByScriptPubkey(scriptPubkey, {
      used
    })
  } else if (addressData.path == null && path != null) {
    try {
      await processor.updateAddressByScriptPubkey(scriptPubkey, {
        ...addressData,
        path
      })
    } catch (err) {
      if (err.message === 'Cannot update address that does not exist') {
        await saveNewAddress()
      } else {
        throw err
      }
    }
  }
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

interface FindLastUsedIndexArgs extends FormatArgs {
  changeIndex: number
}

/**
 * Assumes the last used index is:
 *    addressCount - gapLimit - 1
 * Verified by checking the ~used~ flag on the address and then checking newer ones.
 * @param args - FindLastUsedIndexArgs
 */
const findLastUsedIndex = async (
  args: FindLastUsedIndexArgs
): Promise<number> => {
  const { format, changeIndex, currencyInfo, processor } = args

  const path: AddressPath = {
    format,
    changeIndex,
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

interface GetFreshAddressArgs extends FormatArgs {
  changeIndex: number
}

interface GetFreshAddressReturn {
  address: string
  legacyAddress: string
}

const internalGetFreshAddress = async (
  args: GetFreshAddressArgs
): Promise<GetFreshAddressReturn> => {
  const { format, changeIndex, walletTools, processor } = args

  const path = {
    format,
    changeIndex,
    addressIndex: (await findLastUsedIndex(args)) + 1
  }
  let scriptPubkey = await processor.fetchScriptPubkeyByPath(path)
  scriptPubkey =
    scriptPubkey ?? (await walletTools.getScriptPubkey(path)).scriptPubkey
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (!scriptPubkey) {
    throw new Error('Unknown address path')
  }
  return walletTools.scriptPubkeyToAddress({
    scriptPubkey,
    format
  })
}

interface ProcessAddressArgs extends FormatArgs {
  address: string
}

const processAddress = async (args: ProcessAddressArgs): Promise<void> => {
  const { address, blockBook, addressesToWatch, onAddressChecked } = args

  const firstProcess = !addressesToWatch.has(address)
  if (firstProcess) {
    addressesToWatch.add(address)
    blockBook.watchAddresses(
      Array.from(addressesToWatch),
      async (response): Promise<void> => {
        await setLookAhead(args)
        await processAddress({ ...args, address: response.address })
      }
    )
  }

  await Promise.all([
    processAddressTransactions(args),
    processAddressUtxos(args)
  ])

  firstProcess && onAddressChecked()
}

interface ProcessAddressTxsArgs extends FormatArgs {
  address: string
  page?: number
  networkQueryVal?: number
}

const processAddressTransactions = async (
  args: ProcessAddressTxsArgs
): Promise<void> => {
  const { address, page = 1, processor, walletTools, blockBook } = args

  const scriptPubkey = walletTools.addressToScriptPubkey(address)
  const addressData = await processor.fetchAddressByScriptPubkey(scriptPubkey)
  const networkQueryVal = args.networkQueryVal ?? addressData?.networkQueryVal
  const {
    transactions = [],
    txs,
    unconfirmedTxs,
    totalPages
  } = await blockBook.fetchAddress(address, {
    details: 'txs',
    from: networkQueryVal,
    perPage: BLOCKBOOK_TXS_PER_PAGE,
    page
  })

  // If address is used and previously not marked as used, mark as used.
  const used = txs > 0 || unconfirmedTxs > 0
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (used && !addressData?.used && page === 1) {
    await processor.updateAddressByScriptPubkey(scriptPubkey, {
      used
    })
  }

  for (const rawTx of transactions) {
    const tx = processRawTx({ ...args, tx: rawTx })
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    processor.saveTransaction(tx)
  }

  if (page < totalPages) {
    await processAddressTransactions({
      ...args,
      page: page + 1,
      networkQueryVal
    })
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

interface FetchTransactionArgs extends CommonArgs {
  txid: string
}

const fetchTransaction = async (
  args: FetchTransactionArgs
): Promise<IProcessorTransaction> => {
  const { txid, processor, blockBook } = args
  let tx = await processor.fetchTransaction(txid)
  if (tx == null) {
    const rawTx = await blockBook.fetchTransaction(txid)
    tx = processRawTx({ ...args, tx: rawTx })
  }
  return tx
}

interface ProcessAddressUtxosArgs extends FormatArgs {
  address: string
}

const processAddressUtxos = async (
  args: ProcessAddressUtxosArgs
): Promise<void> => {
  const {
    address,
    format,
    currencyInfo,
    walletTools,
    processor,
    blockBook,
    emitter,
    metadata
  } = args

  const scriptPubkey = walletTools.addressToScriptPubkey(address)
  const addressData = await processor.fetchAddressByScriptPubkey(scriptPubkey)
  if (addressData?.path == null) {
    return
  }

  const oldUtxos = await processor.fetchUtxosByScriptPubkey(scriptPubkey)
  const oldUtxoMap = oldUtxos.reduce<{ [id: string]: IUTXO }>(
    (obj, utxo) => ({
      ...obj,
      [utxo.id]: utxo
    }),
    {}
  )
  const accountUtxos = await blockBook.fetchAddressUtxos(address)

  let balance = '0'

  for (const utxo of accountUtxos) {
    const id = `${utxo.txid}_${utxo.vout}`

    // Any UTXOs listed in the oldUtxoMap after the for loop will be deleted from the database.
    // If we do not already know about this UTXO, lets process it and add it to the database.
    if (oldUtxoMap[id] != null) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete oldUtxoMap[id]
      continue
    }

    let scriptType: ScriptTypeEnum
    let script: string
    let redeemScript: string | undefined
    switch (currencyFormatToPurposeType(format)) {
      case BIP43PurposeTypeEnum.Airbitz:
      case BIP43PurposeTypeEnum.Legacy:
        script = (await fetchTransaction({ ...args, txid: utxo.txid })).hex
        scriptType = ScriptTypeEnum.p2pkh
        break
      case BIP43PurposeTypeEnum.WrappedSegwit:
        script = scriptPubkey
        scriptType = ScriptTypeEnum.p2wpkhp2sh
        redeemScript = walletTools.getScriptPubkey(addressData.path)
          .redeemScript
        break
      case BIP43PurposeTypeEnum.Segwit:
        script = scriptPubkey
        scriptType = ScriptTypeEnum.p2wpkh
        break
    }

    balance = bs.add(balance, utxo.value)

    processor.saveUtxo({
      id,
      txid: utxo.txid,
      vout: utxo.vout,
      value: utxo.value,
      scriptPubkey,
      script,
      redeemScript,
      scriptType,
      blockHeight: utxo.height ?? 0
    })
  }

  for (const id in oldUtxoMap) {
    processor.removeUtxo(oldUtxoMap[id])
  }

  const oldBalance = addressData?.balance ?? '0'
  const diff = bs.sub(balance, oldBalance)
  if (diff !== '0') {
    const newWalletBalance = bs.add(metadata.balance, diff)
    emitter.emit(
      EmitterEvent.BALANCE_CHANGED,
      currencyInfo.currencyCode,
      newWalletBalance
    )

    await processor.updateAddressByScriptPubkey(scriptPubkey, { balance })
  }
}
