import { EdgeCurrencyInfo, EdgeCurrencyTools, EdgeIo } from 'edge-core-js/lib/types'
import { EdgeCurrencyEngineOptions, EdgeWalletInfo } from 'edge-core-js/lib/types/types'

export enum EngineCoinType {
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
  options: EdgeCurrencyEngineOptions
  io: EdgeIo
}
