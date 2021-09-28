import { asNumber, asObject, asString } from 'cleaners'
import {
  EdgeCurrencyEngineOptions,
  EdgeCurrencyInfo,
  EdgeCurrencyTools,
  EdgeIo,
  EdgeWalletInfo
} from 'edge-core-js/types'

import { IUTXO } from '../utxobased/db/types'
import { EngineEmitter } from './makeEngineEmitter'
import { PluginState } from './pluginState'

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
  setRBF?: boolean
  CPFP?: string
}

export interface EngineCurrencyInfo extends EdgeCurrencyInfo {
  formats?: CurrencyFormat[]
  forks?: string[]
  coinType: number
  currencyType: EngineCurrencyType
  network: string // The offical network in lower case - Needs to match the Bitcoin Lib Network Type
  networkType?: NetworkEnum
  uriPrefix?: string
  gapLimit: number
  defaultFee: number
  feeUpdateInterval: number
  earnComFeeInfoServer?: string
  mempoolSpaceFeeInfoServer?: string
  customFeeSettings: CustomFeeSetting[]
  simpleFeeSettings: SimpleFeeSettings
}

export type CustomFeeSetting = 'satPerByte'

export type FeeRates = ReturnType<typeof asFeeRates>
export const asFeeRates = asObject({
  lowFee: asString,
  standardFeeLow: asString,
  standardFeeHigh: asString,
  highFee: asString
})

export type SimpleFeeSettings = ReturnType<typeof asSimpleFeeSettings>
export const asSimpleFeeSettings = asObject({
  ...asFeeRates.shape,
  standardFeeLowAmount: asString,
  standardFeeHighAmount: asString
})

export interface EngineConfig {
  network: NetworkEnum
  walletInfo: EdgeWalletInfo
  currencyInfo: EngineCurrencyInfo
  currencyTools: EdgeCurrencyTools
  options: EngineOptions
  io: EdgeIo
  pluginState: PluginState
}

export interface EngineOptions extends EdgeCurrencyEngineOptions {
  emitter: EngineEmitter
}

export type LocalWalletMetadata = ReturnType<typeof asLocalWalletMetadata>
export const asLocalWalletMetadata = asObject({
  balance: asString,
  lastSeenBlockHeight: asNumber
})
