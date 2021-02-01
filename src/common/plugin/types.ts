import { EdgeCurrencyInfo, EdgeCurrencyTools, EdgeIo } from 'edge-core-js/lib/types'
import { EdgeCurrencyEngineOptions, EdgeWalletInfo } from 'edge-core-js/lib/types/types'
import { EdgeTransaction, EdgeTxidMap } from 'edge-core-js'
import EventEmitter from 'events'
import { IProcessorTransaction } from '../utxobased/db/types'

// this enumerates the network types of single coins. Can be expanded to add regtest, signet, stagenet etc.
export enum NetworkEnum {
  Mainnet = 'mainnet',
  Testnet = 'testnet',
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

export interface Emitter extends EventEmitter {
  emit(event: EmitterEvent.TRANSACTIONS_CHANGED, transactions: EdgeTransaction[]): boolean

  emit(event: EmitterEvent.PROCESSOR_TRANSACTION_CHANGED, transaction: IProcessorTransaction): boolean

  emit(event: EmitterEvent.BALANCE_CHANGED, currencyCode: string, nativeBalance: string): boolean

  emit(event: EmitterEvent.BLOCK_HEIGHT_CHANGED, blockHeight: number): boolean

  emit(event: EmitterEvent.ADDRESSES_CHECKED, progressRatio: number): boolean

  emit(event: EmitterEvent.TXIDS_CHANGED, txids: EdgeTxidMap): boolean

  on(event: EmitterEvent.TRANSACTIONS_CHANGED, listener: (transactions: EdgeTransaction[]) => void): this

  on(event: EmitterEvent.PROCESSOR_TRANSACTION_CHANGED, listener: (transaction: IProcessorTransaction) => void): this

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
