import { EdgeFreshAddress, EdgeWalletInfo } from 'edge-core-js'
import { Mutex } from 'async-mutex'
import * as bs from 'biggystring'

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
import { UTXOPluginWalletTools } from './makeUtxoWalletTools'
import { Processor } from '../db/Processor'
import { BlockBook, ITransaction } from '../network/BlockBook'
import { IAddress, IProcessorTransaction, IUTXO } from '../db/types'
import {
  currencyFormatToPurposeType,
  getCurrencyFormatFromPurposeType,
  getFormatSupportedBranches,
  getPurposeTypeFromKeys,
  getWalletSupportedFormats,
  validScriptPubkeyFromAddress
} from './utils'
import { BIP43PurposeTypeEnum, ScriptTypeEnum } from '../keymanager/keymanager'
import { batchFunctions } from '../../utils'

export interface UtxoEngineState {
  start(): Promise<void>

  stop(): Promise<void>

  getFreshAddress(change?: boolean): Promise<EdgeFreshAddress>

  addGapLimitAddresses(addresses: string[]): Promise<void>

  markAddressUsed(address: string): Promise<void>
}

interface UtxoEngineStateConfig extends EngineConfig {
  walletTools: UTXOPluginWalletTools
  processor: Processor
  blockBook: BlockBook
  metadata: LocalWalletMetadata
}

export async function makeUtxoEngineState(config: UtxoEngineStateConfig): Promise<UtxoEngineState> {
  const {
    network,
    currencyInfo,
    walletInfo,
    walletTools,
    options: {
      emitter
    },
    processor,
    blockBook,
    metadata
  } = config

  const addressesToWatch = new Set<string>()
  const mutex = new Mutex()

  emitter.on(EmitterEvent.ADDRESSES_CHECKED, (progress) => {
    console.log('progress:', progress)
  })

  return {
    async start(): Promise<void> {
      let processedCount = 0
      const onAddressChecked = async () => {
        processedCount = processedCount + 1
        const totalCount = await getTotalAddressCount({ walletInfo, currencyInfo, processor })
        const ratio = processedCount / totalCount
        emitter.emit(EmitterEvent.ADDRESSES_CHECKED, ratio)
      }

      const formatsToProcess = getWalletSupportedFormats(walletInfo)
      for (const format of formatsToProcess) {
        const args = {
          ...config,
          format,
          emitter: config.options.emitter,
          addressesToWatch,
          onAddressChecked,
          mutex
        }

        await setLookAhead(args)
        await processFormatAddresses(args)
      }
    },

    async stop(): Promise<void> {
    },

    async getFreshAddress(change?: boolean): Promise<EdgeFreshAddress> {
      const walletPurpose = getPurposeTypeFromKeys(walletInfo)
      const changeIndex = change && walletPurpose !== BIP43PurposeTypeEnum.Airbitz ? 1 : 0
      if (walletPurpose === BIP43PurposeTypeEnum.Segwit) {
        const { address: publicAddress } = await getFreshAddress({
          ...config,
          format: getCurrencyFormatFromPurposeType(BIP43PurposeTypeEnum.WrappedSegwit),
          changeIndex,
          find: false
        })

        const { address: segwitAddress } = await getFreshAddress({
          ...config,
          format: getCurrencyFormatFromPurposeType(BIP43PurposeTypeEnum.Segwit),
          changeIndex,
          find: false
        })

        return {
          publicAddress,
          segwitAddress
        }
      } else {
        const { address: publicAddress, legacyAddress } = await getFreshAddress({
          ...config,
          format: getCurrencyFormatFromPurposeType(walletPurpose),
          changeIndex,
          find: false
        })

        return {
          publicAddress,
          legacyAddress: legacyAddress !== publicAddress ? legacyAddress : undefined
        }
      }
    },

    async addGapLimitAddresses(addresses: string[]): Promise<void> {
      const batchSize = 10
      const fns = addresses.map((address) => async () => {
        const scriptPubkey = walletTools.addressToScriptPubkey(address)
        await saveAddress({
          scriptPubkey,
          processor
        })
      })
      await batchFunctions({
        fns,
        batchSize
      })
    },

    async markAddressUsed(address: string): Promise<void> {
      const scriptPubkey = walletTools.addressToScriptPubkey(address)
      return processor.updateAddressByScriptPubkey(scriptPubkey, { used: true })
    }
  }
}

interface SetLookAheadArgs extends CommonArgs {
  format: CurrencyFormat
}

const setLookAhead = async (args: SetLookAheadArgs) => {
  const {
    format,
    currencyInfo,
    walletTools,
    processor,
    mutex
  } = args

  const release = await mutex.acquire()

  try {
    const branches = getFormatSupportedBranches(format)
    for (const branch of branches) {
      const partialPath: Omit<AddressPath, 'addressIndex'> = {
        format,
        changeIndex: branch
      }

      const getLastUsed = () => findLastUsedIndex({ ...args, ...partialPath })
      const getAddressCount = () => processor.fetchAddressCountFromPathPartition(partialPath)

      let lastUsed = await getLastUsed()
      let addressCount = await getAddressCount()
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
        await processAddressBalance({
          ...args,
          address
        })

        lastUsed = await getLastUsed()
        addressCount = await getAddressCount()
      }
    }
  } finally {
    release()
  }
}

interface SaveAddressArgs {
  scriptPubkey: string
  path?: AddressPath
  processor: Processor
}

const saveAddress = async (args: SaveAddressArgs, count = 0): Promise<void> => {
  const {
    scriptPubkey,
    path,
    processor
  } = args

  const saveNewAddress = () =>
    processor.saveAddress({
      scriptPubkey,
      path,
      used: false,
      networkQueryVal: 0,
      lastQuery: 0,
      lastTouched: 0,
      balance: '0'
    })

  const addressData = await processor.fetchAddressByScriptPubkey(scriptPubkey)
  if (!addressData) {
    await saveNewAddress()
  } else if (!addressData.path && path) {
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

const getTotalAddressCount = async (args: GetTotalAddressCountArgs): Promise<number> => {
  const walletFormats = getWalletSupportedFormats(args.walletInfo)

  let count = 0
  for (const format of walletFormats) {
    count += await getFormatAddressCount({ ...args, format })
  }

  return count
}

interface GetFormatAddressCountArgs extends GetTotalAddressCountArgs {
  format: CurrencyFormat
}

const getFormatAddressCount = async (args: GetFormatAddressCountArgs): Promise<number> => {
  const {
    format,
    currencyInfo,
    processor
  } = args

  let count = 0

  const branches = getFormatSupportedBranches(format)
  for (const branch of branches) {
    let branchCount = await processor.fetchAddressCountFromPathPartition({ format, changeIndex: branch })
    if (branchCount < currencyInfo.gapLimit) branchCount = currencyInfo.gapLimit
    count += branchCount
  }

  return count
}

interface GetFreshIndexArgs {
  format: CurrencyFormat
  changeIndex: number
  currencyInfo: EngineCurrencyInfo
  processor: Processor
  walletTools: UTXOPluginWalletTools
  find?: boolean
}

const getFreshIndex = async (args: GetFreshIndexArgs): Promise<number> => {
  const {
    format,
    changeIndex,
    currencyInfo,
    processor,
    walletTools,
    find = true
  } = args

  const path: AddressPath = {
    format,
    changeIndex,
    addressIndex: 0 // tmp
  }
  const addressCount = await processor.fetchAddressCountFromPathPartition(path)
  path.addressIndex = Math.max(addressCount - currencyInfo.gapLimit, 0)

  return find
    ? findFreshIndex({ path, processor, walletTools })
    : path.addressIndex
}

const findLastUsedIndex = async (args: GetFreshIndexArgs): Promise<number> => {
  const {
    format,
    changeIndex,
    processor,
    walletTools
  } = args

  const freshIndex = await getFreshIndex(args)
  const addressCount = await processor.fetchAddressCountFromPathPartition({
    format,
    changeIndex
  })
  let lastUsedIndex = freshIndex - 1
  if (lastUsedIndex >= 0) {
    for (let i = lastUsedIndex; i < addressCount; i++) {
      const addressData = await fetchAddressDataByPath({
        processor,
        walletTools,
        path: {
          format,
          changeIndex,
          addressIndex: i
        }
      })
      if (addressData.used && i > lastUsedIndex) lastUsedIndex = i
    }
  }
  return lastUsedIndex
}

interface FindFreshIndexArgs {
  path: AddressPath
  processor: Processor
  walletTools: UTXOPluginWalletTools
}

const findFreshIndex = async (args: FindFreshIndexArgs): Promise<number> => {
  const {
    path,
    processor
  } = args

  const addressCount = await processor.fetchAddressCountFromPathPartition(path)
  if (path.addressIndex >= addressCount) return path.addressIndex

  const addressData = await fetchAddressDataByPath(args)
  // If this address is not used check the previous one
  if (!addressData.used && path.addressIndex > 0) {
    const prevPath = {
      ...path,
      addressIndex: path.addressIndex - 1
    }
    const prevAddressData = await fetchAddressDataByPath({
      ...args,
      path: prevPath
    })
    // If previous address is used we know this address is the last used
    if (prevAddressData.used) {
      return path.addressIndex
    } else if (path.addressIndex > 1) {
      // Since we know the previous address is also unused, start the search from 2nd previous address
      path.addressIndex -= 2
      return findFreshIndex(args)
    }
  } else if (addressData.used) {
    // If this address is used, traverse forward to find an unused address
    path.addressIndex++
    return findFreshIndex(args)
  }

  return path.addressIndex
}

interface FetchAddressDataByPath {
  path: AddressPath
  processor: Processor
  walletTools: UTXOPluginWalletTools
}

const fetchAddressDataByPath = async (args: FetchAddressDataByPath): Promise<IAddress> => {
  const {
    path,
    processor,
    walletTools
  } = args

  const scriptPubkey =
    await processor.fetchScriptPubkeyByPath(path) ??
    walletTools.getScriptPubkey(path).scriptPubkey

  const addressData = await processor.fetchAddressByScriptPubkey(scriptPubkey)
  if (!addressData) throw new Error('Address data unknown')
  return addressData
}

interface GetFreshAddressArgs extends GetFreshIndexArgs {
  walletTools: UTXOPluginWalletTools
}

interface GetFreshAddressReturn {
  address: string
  legacyAddress: string
}

const getFreshAddress = async (args: GetFreshAddressArgs): Promise<GetFreshAddressReturn> => {
  const {
    format,
    changeIndex,
    walletTools,
    processor
  } = args

  const path = {
    format,
    changeIndex,
    addressIndex: await getFreshIndex(args)
  }
  let scriptPubkey = await processor.fetchScriptPubkeyByPath(path)
  scriptPubkey = scriptPubkey ?? (await walletTools.getScriptPubkey(path)).scriptPubkey
  if (!scriptPubkey) {
    throw new Error('Unknown address path')
  }
  return walletTools.scriptPubkeyToAddress({
    scriptPubkey,
    format
  })
}

interface CommonArgs {
  network: NetworkEnum
  currencyInfo: EngineCurrencyInfo
  walletInfo: EdgeWalletInfo
  walletTools: UTXOPluginWalletTools
  processor: Processor
  blockBook: BlockBook
  addressesToWatch: Set<string>
  emitter: Emitter
  metadata: LocalWalletMetadata
  mutex: Mutex
}

interface ProcessFormatAddressesArgs extends CommonArgs {
  format: CurrencyFormat
  onAddressChecked?: () => Promise<void>
}

const processFormatAddresses = async (args: ProcessFormatAddressesArgs) => {
  const branches = getFormatSupportedBranches(args.format)
  for (const branch of branches) {
    await processPathAddresses({ ...args, changeIndex: branch })
  }
}

interface ProcessPathAddressesArgs extends ProcessFormatAddressesArgs {
  changeIndex: number
}

const processPathAddresses = async (args: ProcessPathAddressesArgs) => {
  const {
    walletTools,
    processor,
    format,
    changeIndex
  } = args

  let processAddressPromises: Promise<any>[] = []
  const addressCount = await processor.fetchAddressCountFromPathPartition({ format, changeIndex })
  for (let i = 0; i < addressCount; i++) {
    const path: AddressPath = {
      format,
      changeIndex,
      addressIndex: i
    }
    let scriptPubkey = await processor.fetchScriptPubkeyByPath(path)
    scriptPubkey = scriptPubkey ?? walletTools.getScriptPubkey(path).scriptPubkey
    const { address } = walletTools.scriptPubkeyToAddress({
      scriptPubkey,
      format
    })
    processAddressPromises.push(
      processAddress({ ...args, address })
    )

    if (processAddressPromises.length >= 5) {
      await Promise.all(processAddressPromises)
      processAddressPromises = []
    }
  }
  await Promise.all(processAddressPromises)
}

interface FetchTransactionArgs {
  txid: string
  network: NetworkEnum
  currencyInfo: EngineCurrencyInfo
  processor: Processor
  blockBook: BlockBook
}

const fetchTransaction = async (args: FetchTransactionArgs): Promise<IProcessorTransaction> => {
  const { txid, processor, blockBook } = args
  let tx = await processor.fetchTransaction(txid)
  if (!tx) {
    const rawTx = await blockBook.fetchTransaction(txid)
    tx = processRawTx({ ...args, tx: rawTx })
  }
  return tx
}

interface ProcessAddressArgs extends CommonArgs {
  address: string
  format: CurrencyFormat
  onAddressChecked?: () => Promise<void>
}

const processAddress = async (args: ProcessAddressArgs) => {
  const {
    address,
    blockBook,
    addressesToWatch,
    onAddressChecked
  } = args

  const firstProcess = !addressesToWatch.has(address)
  if (firstProcess) {
    addressesToWatch.add(address)
    blockBook.watchAddresses(Array.from(addressesToWatch), async (response) => {
      await setLookAhead(args)
      await processAddress({ ...args, address: response.address })
    })
  }

  await Promise.all([
    processAddressBalance(args),
    processAddressTransactions(args),
    processAddressUtxos(args)
  ])

  firstProcess && await onAddressChecked?.()
}

interface ProcessAddressBalanceArgs {
  address: string
  processor: Processor
  currencyInfo: EngineCurrencyInfo
  walletTools: UTXOPluginWalletTools
  blockBook: BlockBook
  emitter: Emitter
  metadata: LocalWalletMetadata
}

const processAddressBalance = async (args: ProcessAddressBalanceArgs): Promise<void> => {
  const {
    address,
    processor,
    currencyInfo,
    walletTools,
    blockBook,
    emitter,
    metadata
  } = args

  const scriptPubkey = walletTools.addressToScriptPubkey(address)
  const addressData = await processor.fetchAddressByScriptPubkey(scriptPubkey)

  const accountDetails = await blockBook.fetchAddress(address)
  const oldBalance = addressData?.balance ?? '0'
  const balance = bs.add(accountDetails.balance, accountDetails.unconfirmedBalance)
  const diff = bs.sub(balance, oldBalance)
  if (diff !== '0') {
    const newWalletBalance = bs.add(metadata.balance, diff)
    emitter.emit(EmitterEvent.BALANCE_CHANGED, currencyInfo.currencyCode, newWalletBalance)
  }
  const used = accountDetails.txs > 0 || accountDetails.unconfirmedTxs > 0

  await processor.updateAddressByScriptPubkey(scriptPubkey, {
    balance,
    used
  })
}

interface ProcessAddressTxsArgs {
  address: string
  network: NetworkEnum
  currencyInfo: EngineCurrencyInfo
  processor: Processor
  walletTools: UTXOPluginWalletTools
  blockBook: BlockBook
}

const processAddressTransactions = async (args: ProcessAddressTxsArgs, page = 1): Promise<void> => {
  const {
    address,
    processor,
    walletTools,
    blockBook
  } = args

  const scriptPubkey = walletTools.addressToScriptPubkey(address)
  const addressData = await processor.fetchAddressByScriptPubkey(scriptPubkey)
  const {
    transactions = [],
    totalPages
  } = await blockBook.fetchAddress(address, {
    details: 'txs',
    from: addressData?.networkQueryVal,
    perPage: 10,
    page
  })

  const transactionPromises = transactions.map(async (rawTx) => {
    const tx = processRawTx({ ...args, tx: rawTx })
    await processor.saveTransaction(tx)
  })
  await Promise.all(transactionPromises)

  if (page < totalPages) {
    await processAddressTransactions(args, ++page)
  }
}

interface ProcessRawTxArgs {
  tx: ITransaction
  network: NetworkEnum
  currencyInfo: EngineCurrencyInfo
}

const processRawTx = (args: ProcessRawTxArgs): IProcessorTransaction => {
  const { tx, currencyInfo } = args
  return {
    txid: tx.txid,
    hex: tx.hex,
    blockHeight: tx.blockHeight,
    date: tx.blockTime,
    fees: tx.fees,
    inputs: tx.vin.map((input) => ({
      txId: input.txid,
      outputIndex: input.vout, // case for tx `fefac8c22ba1178df5d7c90b78cc1c203d1a9f5f5506f7b8f6f469fa821c2674` no `vout` for input
      scriptPubkey: validScriptPubkeyFromAddress({
        address: input.addresses[0],
        coin: currencyInfo.network,
        network: args.network
      }),
      amount: input.value
    })),
    outputs: tx.vout.map((output) => ({
      index: output.n,
      scriptPubkey: output.hex ?? validScriptPubkeyFromAddress({
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

interface ProcessAddressUtxosArgs {
  address: string
  network: NetworkEnum
  currencyInfo: EngineCurrencyInfo
  walletTools: UTXOPluginWalletTools
  processor: Processor
  blockBook: BlockBook
}

const processAddressUtxos = async (args: ProcessAddressUtxosArgs): Promise<void> => {
  const {
    address,
    walletTools,
    processor,
    blockBook
  } = args
  const scriptPubkey = walletTools.addressToScriptPubkey(address)
  const addressData = await processor.fetchAddressByScriptPubkey(scriptPubkey)
  if (!addressData || !addressData.path) {
    return
  }

  const oldUtxos = await processor.fetchUtxosByScriptPubkey(scriptPubkey)
  const oldUtxoMap = oldUtxos.reduce<{ [id: string]: IUTXO }>((obj, utxo) => ({
    ...obj,
    [utxo.id]: utxo
  }), {})
  const accountUtxos = await blockBook.fetchAddressUtxos(address)

  for (const utxo of accountUtxos) {
    const id = `${utxo.txid}_${utxo.vout}`

    // Any UTXOs listed in the oldUtxoMap after the for loop will be deleted from the database.
    // If we do not already know about this UTXO, lets process it and add it to the database.
    if (oldUtxoMap[id]) {
      delete oldUtxoMap[id]
      continue
    }

    let scriptType: ScriptTypeEnum
    let script: string
    let redeemScript: string | undefined
    switch (currencyFormatToPurposeType(addressData.path.format)) {
      case BIP43PurposeTypeEnum.Airbitz:
      case BIP43PurposeTypeEnum.Legacy:
        script = (await fetchTransaction({ ...args, txid: utxo.txid })).hex
        scriptType = ScriptTypeEnum.p2pkh
        break
      case BIP43PurposeTypeEnum.WrappedSegwit:
        script = scriptPubkey
        scriptType = ScriptTypeEnum.p2wpkhp2sh
        redeemScript = walletTools.getScriptPubkey(addressData.path).redeemScript
        break
      case BIP43PurposeTypeEnum.Segwit:
        script = scriptPubkey
        scriptType = ScriptTypeEnum.p2wpkh
        break
    }

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
}
