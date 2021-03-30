import {
  EdgeCurrencyEngineOptions,
  EdgeCurrencyInfo,
  EdgeCurrencyTools,
  EdgeIo,
  EdgeWalletInfo
} from 'edge-core-js'

import { IUTXO } from '../utxobased/db/types'
import { EngineEmitter } from './makeEngineEmitter'

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
  emitter: EngineEmitter
}

export interface LocalWalletMetadata {
  balance: string
  lastSeenBlockHeight: number
}
