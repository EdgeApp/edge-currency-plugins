import { EdgeTransaction, EdgeTxidMap } from 'edge-core-js'
import {
  EdgeCurrencyInfo,
  EdgeCurrencyTools,
  EdgeIo
} from 'edge-core-js/lib/types'
import {
  EdgeCurrencyEngineOptions,
  EdgeWalletInfo
} from 'edge-core-js/lib/types/types'

import { IProcessorTransaction, IUTXO } from '../utxobased/db/types'

// this enumerates the network types of single coins. Can be expanded to add regtest, signet, stagenet etc.
export enum NetworkEnum {
  Mainnet = 'mainnet',
  Testnet = 'testnet'
}

export type CurrencyFormat = 'bip32' | 'bip44' | 'bip49' | 'bip84'

export interface AddressPath {
  format: CurrencyFormat
  changeIndex: number
  addressIndex: number
}

export enum EngineCurrencyType {
  UTXO
}

export interface TxOptions {
  utxos?: IUTXO[]
  subtractFee?: boolean
}

export interface EngineCurrencyInfo extends EdgeCurrencyInfo {
  formats?: CurrencyFormat[]
  forks?: string[]
  coinType: number
  currencyType: EngineCurrencyType
  network: string // The offical network in lower case - Needs to match the Bitcoin Lib Network Type
  uriPrefix?: string
  gapLimit: number
  defaultFee: number
  feeUpdateInterval: number
  customFeeSettings: string[]
  simpleFeeSettings: SimpleFeeSettings
}

export interface SimpleFeeSettings {
  highFee: string
  lowFee: string
  standardFeeLow: string
  standardFeeHigh: string
  standardFeeLowAmount: string
  standardFeeHighAmount: string
}

export interface EngineConfig {
  network: NetworkEnum
  walletInfo: EdgeWalletInfo
  currencyInfo: EngineCurrencyInfo
  currencyTools: EdgeCurrencyTools
  options: EngineOptions
  io: EdgeIo
}

interface EngineOptions extends EdgeCurrencyEngineOptions {
  emitter: Emitter
}

export interface Emitter {
  emit: ((
    event: EmitterEvent.TRANSACTIONS_CHANGED,
    transactions: EdgeTransaction[]
  ) => this) &
    ((
      event: EmitterEvent.PROCESSOR_TRANSACTION_CHANGED,
      transaction: IProcessorTransaction
    ) => this) &
    ((
      event: EmitterEvent.BALANCE_CHANGED,
      currencyCode: string,
      nativeBalance: string
    ) => this) &
    ((event: EmitterEvent.BLOCK_HEIGHT_CHANGED, blockHeight: number) => this) &
    ((event: EmitterEvent.ADDRESSES_CHECKED, progressRatio: number) => this) &
    ((event: EmitterEvent.TXIDS_CHANGED, txids: EdgeTxidMap) => this)

  on: ((
    event: EmitterEvent.TRANSACTIONS_CHANGED,
    listener: (transactions: EdgeTransaction[]) => void | Promise<void>
  ) => this) &
    ((
      event: EmitterEvent.PROCESSOR_TRANSACTION_CHANGED,
      listener: (transaction: IProcessorTransaction) => void | Promise<void>
    ) => this) &
    ((
      event: EmitterEvent.BALANCE_CHANGED,
      listener: (
        currencyCode: string,
        nativeBalance: string
      ) => void | Promise<void>
    ) => this) &
    ((
      event: EmitterEvent.BLOCK_HEIGHT_CHANGED,
      listener: (blockHeight: number) => void | Promise<void>
    ) => this) &
    ((
      event: EmitterEvent.ADDRESSES_CHECKED,
      listener: (progressRatio: number) => void | Promise<void>
    ) => this) &
    ((
      event: EmitterEvent.TXIDS_CHANGED,
      listener: (txids: EdgeTxidMap) => void | Promise<void>
    ) => this)
}

export enum EmitterEvent {
  TRANSACTIONS_CHANGED = 'transactions:changed',
  PROCESSOR_TRANSACTION_CHANGED = 'processor:transactions:changed',
  BALANCE_CHANGED = 'balance:changed',
  BLOCK_HEIGHT_CHANGED = 'block:height:changed',
  ADDRESSES_CHECKED = 'addresses:checked',
  TXIDS_CHANGED = 'txids:changed'
}

export interface LocalWalletMetadata {
  balance: string
  lastSeenBlockHeight: number
}
