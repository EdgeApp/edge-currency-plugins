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

import { asUtxoData, TransactionData, UtxoData } from '../utxobased/db/types'
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
  utxos?: UtxoData[]
  subtractFee?: boolean
  CPFP?: string
}
export const asTxOptions = asObject<TxOptions>({
  utxos: asOptional(asArray(asUtxoData)),
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
  formats: CurrencyFormat[]

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
   * data from the Blockbook endpoint with the `TransactionData` object
   * which is stored to disk.
   **/
  txSpecificHandling?: (
    tx: TransactionData,
    specialTx: unknown
  ) => TransactionData
}

export interface ServerConfig {
  type: 'blockbook-nownode'
  uris: string[]
}

/**
 * Coin Info
 */

/**
 * This info is to be used to interface with the AltcoinJs library. It contains
 * network and encoding parameters for the currency.
 */
export interface CoinInfo {
  /**
   * The official network name in lower case. This is a unique network name
   * to identify the `CoinInfo`. It should not conflict with other currency
   * plugins using the same UTXO plugin implementation.
   */
  name: string

  /**
   * Whether the currency uses segwit addresses (wrapped-segwit P2SH, P2WSH, etc).
   */
  segwit: boolean

  /**
   * The SLIP-0044 coin type number. This is used to derive the BIP32 path for
   * addresses.
   */
  coinType: number

  /**
   * Whether the currency should include its cashaddr prefix in the formatted
   * addresses.
   *
   * Defaults to `false`.
   */
  includeCashaddrPrefix?: boolean

  /**
   * Optional sighash value to be passed to AltcoinJS as the sighashType field
   * on inputs. This is primarily used by currencies that leverage it as
   * build-in replay-protection mechanisms.
   */
  sighash?: number

  /**
   * A function to be passed to AltcoinJS `signInput` method. This is used to
   * get the input hash for the signature algorithm before signing the input.
   *
   * This is used if the currency has a custom signature hash function that
   * deviates from the default `bcrypto.hash256` function used for Bitcoin.
   */
  sighashFunction?: (Hash: Buffer) => Buffer

  /**
   * A function to be passed to AltcoinJS `getId` method. This is used to get
   * the transaction hash (txid) for a transaction.
   *
   * This is used if the currency has a custom signature hash function that
   * deviates from the default `bcrypto.hash256` function used for Bitcoin.
   */
  txHashFunction?: (Hash: Buffer) => Buffer

  /**
   * A optional custom decode function passed to AltcoinJS `PaymentCreator`
   * function. This is used to decode the base58 address encoding.
   */
  bs58DecodeFunc?: BaseConverter['decode']

  /**
   * A optional custom encode function passed to AltcoinJS `PaymentCreator`
   * function. This is used to encode the address to a base58 encoding.
   */
  bs58EncodeFunc?: BaseConverter['encode']

  /**
   * A optional custom WIF encoding function passed to AltcoinJS `toWIF` method.
   * This is used to encode the private key into a WIF.
   */
  wifEncodeFunc?: typeof wif.encode

  /**
   * A optional custom extended public/private key encoding function.
   * This is used when converting a public or private key to an xpub/xpriv.
   */
  bip32FromBase58Func?: (
    xKey: string,
    network: BitcoinJSNetwork
  ) => bip32.BIP32Interface

  /**
   * A optional custom seed encoding function.
   * This is used when converting a seed to root private key.
   */
  bip32FromSeedFunc?: (seed: Buffer) => bip32.BIP32Interface

  /**
   * A optional custom UTXO picker function for currencies that may require
   * different UTXO selection algorithms.
   */
  utxoPicker?: UtxoPicker

  /**
   * This is all the currency specific prefixes for encoding and decoding
   * of various data types.
   */
  prefixes: CoinPrefixes
}

/**
 * This is all the currency specific prefixes for encoding and decoding
 * of various data types.
 *
 * The first entry in the array is used for standard serialization.
 * The second entry in the array is used for legacy serialization.
 * All entries in the array are checked whether they can de-serialize the content
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
  engineOptions: EdgeCurrencyEngineOptions
  emitter: EngineEmitter
  initOptions: UtxoInitOptions
  io: EdgeIo
  pluginState: PluginState
}

export type LocalWalletMetadata = ReturnType<typeof asLocalWalletMetadata>
export const asLocalWalletMetadata = asObject({
  balance: asString,
  // scriptPubkey -> balance
  addressBalances: asObject(asString),
  lastSeenBlockHeight: asNumber
})

export const asInfoPayload = asObject({
  blockbookServers: asObject(asBoolean)
})
export type InfoPayload = ReturnType<typeof asInfoPayload>
