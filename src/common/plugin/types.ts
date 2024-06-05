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
import { UtxoInitOptions } from '../utxobased/engine/types'
import { ScriptTemplates } from '../utxobased/info/scriptTemplates/types'
import { UtxoPicker } from '../utxobased/keymanager/utxopicker'
import { EngineEmitter } from './EngineEmitter'
import { PluginState } from './PluginState'

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
  /**
   * Supported wallet formats for address derivation.
   *
   * See https://github.com/EdgeApp/edge-core-js/blob/master/docs/key-formats.md#detailed-key-formats
   **/
  formats?: CurrencyFormat[]

  /**
   * Optional list of currency pluginId strings of which this currency is a fork.
   * These fork currencies are able to be split into this currency.
   **/
  forks?: string[]

  uriPrefix?: string

  /**
   * The gap limit defines the number of indexes to derive from the last used
   * address. This is typically set to 10 for most currencies with the exception
   * of Bitcoin which is set to 25 for historical reasons.
   */
  gapLimit: number

  /**
   * The number of milliseconds defining the frequency that the engine will
   * fetch new fee rates.
   */
  feeUpdateInterval: number

  /**
   * Optional mempool.space URI for fetching fee info.
   *
   * See https://mempool.space/docs/api/rest#get-recommended-fees
   */
  mempoolSpaceFeeInfoServer?: string

  /**
   * Default fee info used before fetching up-to-date fee info from Edge
   * Info Servers.
   */
  defaultFeeInfo: FeeInfo

  /**
   * Optional script template functions for non-standard output script types.
   * These are used to generate the output scriptPubkey for a transaction given
   * pubkey as an argument.
   *
   * The derivation path includes a changeIndex using the 2 bytes of the hash
   * of the script template function output given an empty pubkey value.
   * The engine will search for funds on this derivation path using address
   * indexes up to the gapLimit.
   *
   * This feature is mainly used for replay-protection script templates for
   * Bitcoin Cash and Bitcoin SV replay protection. It it currently limited
   * to supporting only `replayProtection` keyed entries.
   */
  scriptTemplates?: ScriptTemplates

  /**
   * Optional server configurations for the currency engine. Currently only supports
   * NOWNode Blockbook servers configuration types for HTTP fallback.
   *
   * Use `blockbookServers` config in `EdgeCurrencyInfo['defaultSettings']` for
   * the time being. This config controls the WebSocket URI for Blockbook
   * connections over the WebSocket protocol.
   */
  serverConfigs?: ServerConfig[]

  /**
   * An optional codec cleaner (asCodec) for serializing and deserializing an
   * address over network interfaces. This can be used to resolve issues with
   * network interfaces that expect addresses to be formatted differently than
   * what is expected by the engine.
   *
   * For example, if a Blockbook server expects
   * an address URI prefix (mycurrency:), then this cleaner codec can add the
   * necessary translations.
   *
   * See https://cleaners.js.org/#/reference?id=ascodec cleaner codec
   * documentation.
   */
  asBlockbookAddress?: Cleaner<string>

  /**
   * Some currencies require an additional blockbook payload
   * 'getTransactionSpecific' in order to provide all relevant transaction
   * data. If this function is defined, it should merge the unknown `specialTx`
   * data from the Blockbook endpoint with the `IProcessorTransaction` object
   * which is stored to disk.
   **/
  txSpecificHandling?: (
    tx: IProcessorTransaction,
    specialTx: unknown
  ) => IProcessorTransaction
}

export interface ServerConfig {
  type: 'blockbook-nownode'
  uris: string[]
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
  initOptions: UtxoInitOptions
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
