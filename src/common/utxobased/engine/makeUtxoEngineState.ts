import { EdgeFreshAddress, EdgeTxidMap, EdgeWalletInfo } from 'edge-core-js'
import { Mutex } from 'async-mutex'
import { isEqual as lodashIsEqual } from 'lodash'

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
import { IAddress, IUTXO } from '../db/types'
import { ProcessorTransaction } from '../db/Models/ProcessorTransaction'
import {
  currencyFormatToPurposeType,
  getCurrencyFormatFromPurposeType,
  getPurposeTypeFromKeys,
  getWalletSupportedFormats,
  validScriptPubkeyFromAddress
} from './utils'
import { BIP43PurposeTypeEnum, ScriptTypeEnum } from '../keymanager/keymanager'
import * as bs from 'biggystring'

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
      formatsToProcess.map(async (format) => {
        await setLookAhead({
          ...config,
          format,
          emitter: config.options.emitter,
          addressesToWatch,
          onAddressChecked,
          mutex
        })
      })
    },

    async stop(): Promise<void> {
    },

    async getFreshAddress(change?: boolean): Promise<EdgeFreshAddress> {
      const walletPurpose = getPurposeTypeFromKeys(walletInfo)
      const changeIndex = change ? 1 : 0
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
      const addNewPromises = addresses.map(async (address) => {
        const scriptPubkey = walletTools.addressToScriptPubkey(address)
        await saveNewOrUpdateAddressPathIfNeeded({
          scriptPubkey,
          processor,
          walletTools
        })
      })
      await Promise.all(addNewPromises)
    },

    async markAddressUsed(address: string): Promise<void> {
      const scriptPubkey = walletTools.addressToScriptPubkey(address)
      return processor.updateAddressByScriptPubkey(scriptPubkey, { used: true })
    }
  }
}

interface SetLookAheadArgs extends CommonArgs {
  format: CurrencyFormat
  onAddressChecked?: () => Promise<void>
}

const setLookAhead = async (args: SetLookAheadArgs) => {
  const {
    format,
    currencyInfo,
    processor,
    mutex
  } = args

  const release = await mutex.acquire()

  try {
    const changeIndicies: [ 0, 1 ] = [ 0, 1 ]
    const lookAheadPromises = changeIndicies.map(async (changeIndex) => {
      let freshIndex = 0
      for (let i = 0; i < freshIndex + currencyInfo.gapLimit; i++) {
        await saveNewOrUpdateAddressPathIfNeeded({
          ...args,
          path: {
            format,
            changeIndex,
            addressIndex: i
          }
        })

        freshIndex = await getFreshIndex({
          ...args,
          format,
          changeIndex
        })
      }
    })
    await Promise.all(lookAheadPromises)

    processFormatAddresses(args)
  } finally {
    release()
  }
}

interface SaveNewAddressByScriptPubkeyArgs {
  path?: AddressPath
  scriptPubkey?: string
  processor: Processor
  walletTools: UTXOPluginWalletTools
}

const saveNewOrUpdateAddressPathIfNeeded = async (args: SaveNewAddressByScriptPubkeyArgs): Promise<void> => {
  const {
    path,
    processor,
    walletTools
  } = args

  let { scriptPubkey } = args
  if (!scriptPubkey) {
    if (!path) throw new Error('Cannot save/update address without scriptPubkey or path')
    scriptPubkey = walletTools.getScriptPubkey(path).scriptPubkey
  }

  const addressData = await processor.fetchAddressByScriptPubkey(scriptPubkey)
  if (!addressData) {
    await processor.saveAddress({
      scriptPubkey,
      path,
      networkQueryVal: 0,
      lastQuery: 0,
      lastTouched: 0,
      used: false,
      balance: '0'
    })
  } else if (!addressData.path) {
    await processor.updateAddressByScriptPubkey(scriptPubkey, { path })
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

  let receiveCount = await processor.fetchAddressCountFromPathPartition({ format, changeIndex: 0 })
  let changeCount = await processor.fetchAddressCountFromPathPartition({ format, changeIndex: 1 })

  if (receiveCount < currencyInfo.gapLimit) receiveCount = currencyInfo.gapLimit
  if (changeCount < currencyInfo.gapLimit) changeCount = currencyInfo.gapLimit

  return receiveCount + changeCount
}

interface GetFreshIndexArgs {
  format: CurrencyFormat
  changeIndex: 0 | 1
  currencyInfo: EngineCurrencyInfo
  processor: Processor
  find?: boolean
}

const getFreshIndex = async (args: GetFreshIndexArgs): Promise<number> => {
  const {
    format,
    changeIndex,
    currencyInfo,
    processor,
    find = true
  } = args

  const path: AddressPath = {
    format,
    changeIndex,
    addressIndex: 0 // tmp
  }
  const addressCount = await processor.fetchAddressCountFromPathPartition(path)
  const freshIndex = addressCount - currencyInfo.gapLimit
  path.addressIndex = freshIndex < 0 ? 0 : freshIndex
  return find
    ? findFreshIndex({ path, processor })
    : path.addressIndex
}

interface FindFreshIndexArgs {
  path: AddressPath
  processor: Processor
}

const findFreshIndex = async (args: FindFreshIndexArgs): Promise<number> => {
  const {
    path,
    processor,
  } = args

  const addressData = await fetchAddressDataByPath(args)
  // If this address is not used check the previous one
  if (!addressData.used && path.addressIndex > 0) {
    const prevPath = {
      ...path,
      addressIndex: path.addressIndex - 1
    }
    const prevAddressData = await fetchAddressDataByPath({
      processor,
      path: prevPath
    })
    // If previous address is used we know this address is the last used
    if (prevAddressData.used){
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
}

const fetchAddressDataByPath = async (args: FetchAddressDataByPath): Promise<IAddress> => {
  const {
    path,
    processor
  } = args

  const scriptPubkey = await processor.fetchScriptPubkeyByPath(path)
  if (!scriptPubkey) throw new Error('Address path unknown')
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
    processor,
  } = args

  const scriptPubkey = await processor.fetchScriptPubkeyByPath({
    format,
    changeIndex,
    addressIndex: await getFreshIndex(args)
  })
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
  mutex: Mutex
}

interface ProcessAddressArgs extends CommonArgs {
  address: string
  onAddressChecked?: () => Promise<void>
}

interface ProcessFormatAddressesArgs extends CommonArgs {
  format: CurrencyFormat
  onAddressChecked?: () => Promise<void>
}

const processFormatAddresses = (args: ProcessFormatAddressesArgs) => {
  return Promise.all([
    processPathAddresses({ ...args, changeIndex: 0 }),
    processPathAddresses({ ...args, changeIndex: 1 })
  ])
}

interface ProcessPathAddressesArgs extends ProcessFormatAddressesArgs {
  changeIndex: 0 | 1
}

const processPathAddresses = async (args: ProcessPathAddressesArgs) => {
  const {
    walletTools,
    processor,
    format,
    changeIndex
  } = args

  const processAddressPromises: Promise<any>[] = []

  const addressCount = await processor.fetchAddressCountFromPathPartition({ format, changeIndex })
  for (let i = 0; i < addressCount; i++) {
    const path: AddressPath = {
      format,
      changeIndex,
      addressIndex: i
    }
    const { address } = walletTools.getAddress(path)
    processAddressPromises.push(
      processAddress({ ...args, address })
    )
  }

  return Promise.all(processAddressPromises)
}

interface FetchTransactionArgs {
  txid: string
  network: NetworkEnum
  currencyInfo: EngineCurrencyInfo
  processor: Processor
  blockBook: BlockBook
}

const fetchTransaction = async (args: FetchTransactionArgs): Promise<ProcessorTransaction> => {
  const { txid, processor, blockBook } = args
  let tx = await processor.fetchTransaction(txid)
  if (!tx) {
    const rawTx = await blockBook.fetchTransaction(txid)
    tx = processRawTx({ ...args, tx: rawTx })
  }
  return tx
}

const processAddress = async (args: ProcessAddressArgs) => {
  const {
    address,
    currencyInfo,
    walletTools,
    processor,
    blockBook,
    emitter,
    addressesToWatch,
    onAddressChecked
  } = args

  const scriptPubkey = walletTools.addressToScriptPubkey(address)
  const addressData = await processor.fetchAddressByScriptPubkey(scriptPubkey)
  const previouslyUsed = addressData!.used

  const firstProcess = !addressesToWatch.has(address)
  if (firstProcess) {
    addressesToWatch.add(address)
    blockBook.watchAddresses(Array.from(addressesToWatch), (response) => {
      processAddress({ ...args, address: response.address })
    })
  }

  const accountDetails = await blockBook.fetchAddress(address)
  const oldBalance = addressData!.balance ?? '0'
  const balance = bs.add(accountDetails.balance, accountDetails.unconfirmedBalance)
  if (oldBalance !== balance) {
    emitter.emit(EmitterEvent.BALANCE_CHANGED, currencyInfo.currencyCode, balance)
  }
  const used = accountDetails.txs > 0 || accountDetails.unconfirmedTxs > 0

  await Promise.all([
    processAddressTransactions(args),
    processAddressUtxos(args),
    processor.updateAddressByScriptPubkey(scriptPubkey, {
      balance,
      used
    })
  ])

  // If address was previously not used and now it is, call setLookAhead
  // Make sure we have the path saved
  if (!previouslyUsed && used && addressData!.path) {
    await setLookAhead({
      ...args,
      format: addressData!.path!.format
    })
  }

  firstProcess && await onAddressChecked?.()
}

interface ProcessAddressTxsArgs {
  address: string
  network: NetworkEnum
  currencyInfo: EngineCurrencyInfo
  processor: Processor
  walletTools: UTXOPluginWalletTools
  blockBook: BlockBook
  emitter: Emitter
}

const processAddressTransactions = async (args: ProcessAddressTxsArgs, page = 1): Promise<void> => {
  const {
    address,
    processor,
    walletTools,
    blockBook,
    emitter
  } = args

  const scriptPubkey = walletTools.addressToScriptPubkey(address)
  const addressData = await processor.fetchAddressByScriptPubkey(scriptPubkey)
  const {
    transactions = [],
    totalPages
  } = await blockBook.fetchAddress(address, {
    details: 'txs',
    from: addressData?.networkQueryVal,
    page
  })

  const changeTxidMap: EdgeTxidMap = {}
  for (const rawTx of transactions) {
    const tx = processRawTx({ ...args, tx: rawTx })
    processor.saveTransaction(tx)

    changeTxidMap[tx.txid] = tx.date
  }
  if (transactions.length ?? 0 > 0) {
    emitter.emit(EmitterEvent.TXIDS_CHANGED, changeTxidMap)
  }

  if (page < totalPages) {
    await processAddressTransactions(args, ++page)
  }
}

interface ProcessRawTxArgs {
  tx: ITransaction
  network: NetworkEnum
  currencyInfo: EngineCurrencyInfo
}

const processRawTx = (args: ProcessRawTxArgs): ProcessorTransaction => {
  const { tx, currencyInfo } = args
  return new ProcessorTransaction({
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
  })
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
