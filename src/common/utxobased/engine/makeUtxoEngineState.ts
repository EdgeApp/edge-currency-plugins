import * as bs from 'biggystring'
import { EdgeTxidMap, EdgeFreshAddress } from 'edge-core-js'

import {
  AddressPath,
  CurrencyFormat, Emitter,
  EmitterEvent,
  EngineConfig,
  EngineCurrencyInfo,
  LocalWalletMetadata
} from '../../plugin/types'
import { BlockBook, INewTransactionResponse, ITransaction } from '../network/BlockBook'
import { IAddress, IProcessorTransaction, IUTXO } from '../db/types'
import { BIP43PurposeTypeEnum, ScriptTypeEnum } from '../keymanager/keymanager'
import { Processor } from '../db/makeProcessor'
import { UTXOPluginWalletTools } from './makeUtxoWalletTools'
import { getCurrencyFormatFromPurposeType, validScriptPubkeyFromAddress, getPurposeTypeFromKeys, getWalletFormat  } from './utils'

export interface UtxoEngineState {
  start(): Promise<void>

  stop(): Promise<void>

  getFreshAddress(branch?: number): EdgeFreshAddress

  markAddressUsed(address: string): Promise<void>
}

export interface UtxoEngineStateConfig extends EngineConfig {
  walletTools: UTXOPluginWalletTools
  processor: Processor
  blockBook: BlockBook
  metadata: LocalWalletMetadata
}

export function makeUtxoEngineState(config: UtxoEngineStateConfig): UtxoEngineState {
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


  return {
    async start(): Promise<void> {
    },

    async stop(): Promise<void> {
    },

    getFreshAddress(branch = 0): EdgeFreshAddress {
      return {
        publicAddress: ''
      }
    },

    async markAddressUsed(addressStr: string) {
    }
  }
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
