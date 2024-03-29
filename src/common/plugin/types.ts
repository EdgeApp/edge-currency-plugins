import { BaseConverter } from 'base-x'
import * as bip32 from 'bip32'
import {
  asArray,
  asBoolean,
  asMaybe,
  asNumber,
  asObject,
  asOptional,
  asString,
  asValue,
  Cleaner
} from 'cleaners'
import { Disklet } from 'disklet'
import {
  EdgeCurrencyEngineOptions,
  EdgeCurrencyInfo,
  EdgeCurrencyTools,
  EdgeIo,
  EdgeParsedUri,
  EdgeWalletInfo
} from 'edge-core-js/types'
import * as wif from 'wif'

import { asIUTXO, IProcessorTransaction, IUTXO } from '../utxobased/db/types'
import { ScriptTemplates } from '../utxobased/info/scriptTemplates/types'
import { UtxoPicker } from '../utxobased/keymanager/utxopicker'
import { EngineEmitter } from './makeEngineEmitter'
import { PluginState } from './pluginState'

export type CurrencyFormat = ReturnType<typeof asCurrencyFormat>
export const asCurrencyFormat = asValue('bip32', 'bip44', 'bip49', 'bip84')

// Path up to changeIndex
export interface ChangePath {
  format: CurrencyFormat
  changeIndex: number
}
// Path up to addressIndex
export interface AddressPath {
  format: CurrencyFormat
  changeIndex: number
  addressIndex: number
}

export interface TxOptions {
  utxos?: IUTXO[]
  subtractFee?: boolean
  CPFP?: string
}
export const asTxOptions = asObject<TxOptions>({
  utxos: asOptional(asArray(asIUTXO)),
  subtractFee: asOptional(asBoolean),
  CPFP: asOptional(asString)
})

export interface PluginInfo {
  currencyInfo: EdgeCurrencyInfo
  engineInfo: EngineInfo
  coinInfo: CoinInfo
}

export interface EngineInfo {
  formats?: CurrencyFormat[]
  forks?: string[]
  uriPrefix?: string
  gapLimit: number
  defaultFee: number
  feeUpdateInterval: number
  mempoolSpaceFeeInfoServer?: string
  defaultFeeInfo: FeeInfo
  scriptTemplates?: ScriptTemplates
  // Codec Cleaners
  asBlockbookAddress?: Cleaner<string>
  // Coin specific transaction handling
  txSpecificHandling?: (
    tx: IProcessorTransaction,
    specialTx: unknown
  ) => IProcessorTransaction
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
  txHashFunction?: (Hash: Buffer) => Buffer
  bs58DecodeFunc?: BaseConverter['decode']
  bs58EncodeFunc?: BaseConverter['encode']
  wifEncodeFunc?: typeof wif.encode
  bip32FromBase58Func?: (
    xKey: string,
    network: BitcoinJSNetwork
  ) => bip32.BIP32Interface
  bip32FromSeedFunc?: (seed: Buffer) => bip32.BIP32Interface
  utxoPicker?: UtxoPicker
  prefixes: CoinPrefixes
}

/*
  The first entry in the array is used for standard serialization
  The second entry in the array is used for legacy serialization
  All entries in the array are checked whether they can de-serialize the content
*/
export interface CoinPrefixes {
  messagePrefix: string[]
  wif: number[]
  legacyXPriv: number[]
  legacyXPub: number[]
  wrappedSegwitXPriv?: number[]
  wrappedSegwitXPub?: number[]
  segwitXPriv?: number[]
  segwitXPub?: number[]
  pubkeyHash: number[]
  scriptHash: number[]
  bech32?: string[]
  cashaddr?: string[]
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

export interface ExtendedParseUri extends EdgeParsedUri {
  metadata?: EdgeParsedUri['metadata'] & {
    gateway?: boolean
  }
}

export interface EncodeUriMetadata {
  metadata?: {
    name?: string
    notes?: string
    gateway?: boolean
  }
}

export type FeeRates = ReturnType<typeof asFeeRates>
export const asFeeRates = asObject({
  lowFee: asString,
  standardFeeLow: asString,
  standardFeeHigh: asString,
  highFee: asString
})

export type FeeInfo = FeeRates & {
  lowFeeFudgeFactor?: string
  standardFeeLowFudgeFactor?: string
  standardFeeHighFudgeFactor?: string
  highFeeFudgeFactor?: string
  standardFeeLowAmount: string
  standardFeeHighAmount: string
  maximumFeeRate?: string
}
export const asFeeInfo = (fallback?: FeeInfo): Cleaner<FeeInfo> =>
  asObject<FeeInfo>({
    ...asFeeRates.shape,

    lowFeeFudgeFactor: asMaybe(asString, fallback?.lowFeeFudgeFactor),
    standardFeeLowFudgeFactor: asMaybe(
      asString,
      fallback?.standardFeeLowFudgeFactor
    ),
    standardFeeHighFudgeFactor: asMaybe(
      asString,
      fallback?.standardFeeHighFudgeFactor
    ),
    highFeeFudgeFactor: asMaybe(asString, fallback?.highFeeFudgeFactor),

    // The amount of satoshis which will be charged the standardFeeLow
    standardFeeLowAmount: asString,
    // The amount of satoshis which will be charged the standardFeeHigh
    standardFeeHighAmount: asString,
    // A safe-guard for any potential software bugs:
    maximumFeeRate: asOptional(asString, fallback?.maximumFeeRate)
  }).withRest

export interface EngineConfig {
  walletInfo: EdgeWalletInfo
  pluginInfo: PluginInfo
  pluginDisklet: Disklet
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
  // scriptPubkey -> balance
  addressBalances: asObject(asString),
  lastSeenBlockHeight: asNumber
})
