import { EdgeCurrencyInfo, EdgeCurrencyTools, EdgeIo } from 'edge-core-js/lib/types'
import { EdgeCurrencyEngineOptions, EdgeWalletInfo } from 'edge-core-js/lib/types/types'
import { EdgeTransaction, EdgeTxidMap } from 'edge-core-js'

export enum EngineCoinType {
  UTXO
}

export interface EngineCurrencyInfo extends EdgeCurrencyInfo {
  coinType: EngineCoinType
  network: string // The offical network in lower case - Needs to match the Bitcoin Lib Network Type
  gapLimit: number
  defaultFee: number
  feeUpdateInterval: number
  customFeeSettings: string[]
  simpleFeeSettings: {
    highFee: string
    lowFee: string
    standardFeeLow: string
    standardFeeHigh: string
    standardFeeLowAmount: string
    standardFeeHighAmount: string
  }
}

export interface EngineConfig {
  walletInfo: EdgeWalletInfo
  info: EngineCurrencyInfo
  tools: EdgeCurrencyTools
  options: EngineOptions
  io: EdgeIo
}

interface EngineOptions extends EdgeCurrencyEngineOptions {
  emitter: EngineEmitter
}

export interface BlockHeightEmitter {
  emit(event: EngineEvent.BLOCK_HEIGHT_CHANGED, blockHeight: number): this

  on(event: EngineEvent.BLOCK_HEIGHT_CHANGED, listener: (blockHeight: number) => void): this
}

export interface EngineEmitter extends BlockHeightEmitter {
  emit(event: EngineEvent.BLOCK_HEIGHT_CHANGED, blockHeight: number): this

  emit(event: EngineEvent.TRANSACTIONS_CHANGED, transactions: EdgeTransaction[]): this

  emit(event: EngineEvent.ADDRESSES_CHECKED, progressRatio: number): this

  emit(event: EngineEvent.TXIDS_CHANGED, txids: EdgeTxidMap): this

  on(event: EngineEvent.BLOCK_HEIGHT_CHANGED, listener: (blockHeight: number) => void): this

  on(event: EngineEvent.TRANSACTIONS_CHANGED, listener: (transactions: EdgeTransaction[]) => void): this

  on(event: EngineEvent.ADDRESSES_CHECKED, listener: (progressRatio: number) => void): this

  on(event: EngineEvent.TXIDS_CHANGED, listener: (txids: EdgeTxidMap) => void): this
}

export enum EngineEvent {
  TRANSACTIONS_CHANGED = 'transactions:changed',
  BLOCK_HEIGHT_CHANGED = 'block:height:changed',
  ADDRESSES_CHECKED = 'addresses:checked',
  TXIDS_CHANGED = 'txids:changed'
}

export interface LocalWalletMetadata {
  balance: string
}
