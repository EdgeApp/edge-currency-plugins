import { bip32 } from 'altcoin-js'
import { asNumber, asObject, asString } from 'cleaners'
import {
  EdgeCurrencyEngineOptions,
  EdgeCurrencyInfo,
  EdgeCurrencyTools,
  EdgeIo,
  EdgeWalletInfo
} from 'edge-core-js/types'

import { IUTXO } from '../utxobased/db/types'
import { ScriptTemplates } from '../utxobased/info/scriptTemplates/types'
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

export interface TxOptions {
  utxos?: IUTXO[]
  subtractFee?: boolean
  setRBF?: boolean
  CPFP?: string
}

export interface PluginInfo {
  currencyInfo: EdgeCurrencyInfo
  engineInfo: EngineInfo
  coinInfo: CoinInfo
}

export interface EngineInfo {
  formats?: CurrencyFormat[]
  forks?: string[]
  networkType?: NetworkEnum
  uriPrefix?: string
  gapLimit: number
  defaultFee: number
  feeUpdateInterval: number
  mempoolSpaceFeeInfoServer?: string
  customFeeSettings: CustomFeeSetting[]
  simpleFeeSettings: SimpleFeeSettings
  scriptTemplates?: ScriptTemplates
}

/**
 * Coin Info
 */

export interface CoinInfo {
  name: string // The offical network name in lower case. Must match the Bitcoin Lib Network Type
  segwit: boolean
  coinType: number
  sighash?: number
  sighashFunction?: (Hash: Buffer) => Buffer
  bs58DecodeFunc?: (payload: string | undefined) => Buffer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bs58EncodeFunc?: (payload: any) => string
  wifEncodeFunc?: (prefix: unknown, key: unknown, compressed: unknown) => string
  bip32FromBase58Func?: (
    xKey: string,
    network: BitcoinJSNetwork
  ) => bip32.BIP32Interface
  bip32FromSeedFunc?: (seed: Buffer) => bip32.BIP32Interface
  mainnetConstants: CoinPrefixes
  // by default should contain the bitcoin mainnet constants, useful for networks were multiple constants were in use.
  legacyConstants?: CoinPrefixes
  testnetConstants: CoinPrefixes
}

export interface CoinPrefixes {
  messagePrefix: string
  wif: number
  legacyXPriv: number
  legacyXPub: number
  wrappedSegwitXPriv?: number
  wrappedSegwitXPub?: number
  segwitXPriv?: number
  segwitXPub?: number
  pubkeyHash: number
  scriptHash: number
  bech32?: string
  cashaddr?: string
}

interface BitcoinJSNetwork {
  wif: number
  bip32: Bip32
  messagePrefix: string
  bech32: string
  pubKeyHash: number
  scriptHash: number
}

interface Bip32 {
  public: number
  private: number
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
  pluginInfo: PluginInfo
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
