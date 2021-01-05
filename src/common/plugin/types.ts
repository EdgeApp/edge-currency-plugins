import { EdgeCurrencyInfo, EdgeCurrencyTools, EdgeIo } from 'edge-core-js/lib/types'
import { EdgeCurrencyEngineOptions, EdgeWalletInfo } from 'edge-core-js/lib/types/types'
import { EdgeTransaction, EdgeTxidMap } from 'edge-core-js'
import { ProcessorTransaction } from '../utxobased/db/Models/ProcessorTransaction'
import { BIP43PurposeTypeEnum } from '../utxobased/keymanager/keymanager'
import { PluginWalletTools } from './makeWalletTools'

export type CurrencyFormats = 'bip32' | 'bip44' | 'bip49' | 'bip84'

export enum EngineCurrencyType {
  UTXO
}

export interface EngineCurrencyInfo extends EdgeCurrencyInfo {
  formats?: CurrencyFormats[]
  coinType: number
  currencyType: EngineCurrencyType
  network: string // The offical network in lower case - Needs to match the Bitcoin Lib Network Type
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
  walletInfo: EdgeWalletInfo
  info: EngineCurrencyInfo
  currencyTools: EdgeCurrencyTools
  walletTools: PluginWalletTools
  options: EngineOptions
  io: EdgeIo
}

interface EngineOptions extends EdgeCurrencyEngineOptions {
  emitter: Emitter
}

export interface Emitter {
  emit(event: EmitterEvent.TRANSACTIONS_CHANGED, transactions: EdgeTransaction[]): this

  emit(event: EmitterEvent.PROCESSOR_TRANSACTION_CHANGED, transaction: ProcessorTransaction): this

  emit(event: EmitterEvent.BALANCE_CHANGED, currencyCode: string, nativeBalance: string): this

  emit(event: EmitterEvent.BLOCK_HEIGHT_CHANGED, blockHeight: number): this

  emit(event: EmitterEvent.ADDRESSES_CHECKED, progressRatio: number): this

  emit(event: EmitterEvent.TXIDS_CHANGED, txids: EdgeTxidMap): this

  on(event: EmitterEvent.TRANSACTIONS_CHANGED, listener: (transactions: EdgeTransaction[]) => void): this

  on(event: EmitterEvent.PROCESSOR_TRANSACTION_CHANGED, listener: (transaction: ProcessorTransaction) => void): this

  on(event: EmitterEvent.BALANCE_CHANGED, listener: (currencyCode: string, nativeBalance: string) => void): this

  on(event: EmitterEvent.BLOCK_HEIGHT_CHANGED, listener: (blockHeight: number) => void): this

  on(event: EmitterEvent.ADDRESSES_CHECKED, listener: (progressRatio: number) => void): this

  on(event: EmitterEvent.TXIDS_CHANGED, listener: (txids: EdgeTxidMap) => void): this
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
