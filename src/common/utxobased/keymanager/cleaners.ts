import {
  asBoolean,
  asCodec,
  asMaybe,
  asNumber,
  asObject,
  asOptional,
  asString,
  asValue,
  Cleaner
} from 'cleaners'
import { EdgeWalletInfo } from 'edge-core-js/types'

import {
  asCurrencyFormat,
  CurrencyFormat,
  PluginInfo
} from '../../plugin/types'
import { deriveXpubsFromKeys } from '../engine/utils'

// Private key format are a strict subset of all currency formats
const asPrivateKeyFormat = asValue('bip32', 'bip44', 'bip49')
// Default to bip32 always for legacy reasons
const asOptionalPrivateKeyFormat = asOptional(asPrivateKeyFormat, 'bip32')

/**
 * A cleaner for the private key format following the key-formats specification.
 *
 * (spec: https://github.com/EdgeApp/edge-core-js/blob/master/docs/key-formats.md)
 */
export interface PrivateKey {
  coinType: number
  format: CurrencyFormat
  imported?: boolean
  seed: string
}
export function asPrivateKey(
  coinName: string,
  coinType: number = 0
): Cleaner<PrivateKey> {
  return asCodec(
    raw => {
      if (raw == null || typeof raw !== 'object') {
        throw new TypeError('Private keys must be objects')
      }
      return asObject({
        coinType: asOptional(asNumber, coinType),
        format: asOptionalPrivateKeyFormat,
        imported: asOptional(asBoolean),
        seed: asString
      })({ ...raw, seed: raw[`${coinName}Key`] })
    },
    clean => {
      const { coinType, format, imported, seed } = clean
      return {
        coinType,
        format,
        imported,
        [`${coinName}Key`]: seed
      }
    }
  )
}

/**
 * A cleaner for the public key format following the key-formats specification.
 *
 * (spec: https://github.com/EdgeApp/edge-core-js/blob/master/docs/key-formats.md)
 */
export interface PublicKey {
  publicKeys: {
    [format in CurrencyFormat]?: string
  }
}
export const asPublicKey: Cleaner<PublicKey> = asObject({
  publicKeys: asObject({
    bip32: asOptional(asString),
    bip44: asOptional(asString),
    bip49: asOptional(asString),
    bip84: asOptional(asString)
  })
})

/**
 * This utility returns a wallet's supported formats as specified in the
 * key-formats specification.
 */
export const getSupportedFormats = (
  format: CurrencyFormat
): CurrencyFormat[] => {
  switch (format) {
    case 'bip32':
      return ['bip32']
    case 'bip44':
      return ['bip44']
    case 'bip49':
      return ['bip49']
    case 'bip84':
      return ['bip84']
    default:
      throw new Error(`Unsupported format ${format}`)
  }
}

/**
 * An algorithm that defines the primary format for a wallet given all of the
 * wallet's formats and the currency formats (from plugin info).
 *
 * The purpose for this algorithm is to deterministically return a single
 * primary format regardless of the order of the wallet formats given.
 * The algorithm effectively takes the first format in the formats from plugin
 * info that matches one of the formats in the given wallet formats.
 *
 * If no wallet format matches any of the formats in the plugin info, then
 * the primary format is the first format in the wallet format after sorting
 * in ascending order lexicographically.
 */
export const getPrimaryFormat = (
  currencyFormats: CurrencyFormat[],
  walletFormats: CurrencyFormat[]
): CurrencyFormat => {
  return (
    (currencyFormats.length > 0
      ? currencyFormats.find(format => walletFormats.includes(format))
      : undefined) ??
    walletFormats.sort((a, b) => (a === b ? 0 : a > b ? 1 : -1))[0]
  )
}

/**
 * A cleaner that desensitizes the walletInfo object, excluding sensitive
 * keys (seed/mnemonic, sync key, data key, etc). By using this object type
 * internally within the plugin, we can minimize risk of leaking sensitive data.
 *
 * It also includes internal derived data (publicKey, format, walletFormats, etc).
 * This derived data is to be used internally within the plugin and saved to disk (publicKey).
 *
 * The `walletFormats` field is a list of formats from which to derive
 * extended-keys for the wallet.
 *
 * The `primaryFormat` field is the default format from which to derive
 * addresses from.
 */
export interface NumbWalletInfo {
  id: string
  type: string
  keys: {
    imported?: boolean
    primaryFormat: CurrencyFormat
    publicKey: PublicKey
    walletFormats: CurrencyFormat[]
  }
}
export const asNumbWalletInfo = (
  pluginInfo: PluginInfo
): Cleaner<NumbWalletInfo> => {
  return (walletInfo: EdgeWalletInfo): NumbWalletInfo => {
    const { engineInfo, coinInfo } = pluginInfo
    const { id, type } = walletInfo

    const asCurrencyPrivateKey = asPrivateKey(coinInfo.name, coinInfo.coinType)

    const publicKey = asMaybe(asPublicKey)(walletInfo.keys)
    if (publicKey != null) {
      const walletFormats = Object.entries(publicKey.publicKeys)
        // Filter out undefined values in the entries because cleaners allow
        // undefined values for optional fields.
        .filter(([, value]) => value != null)
        // Map to the entry's key as a currency format
        .map(([format]) => asMaybe(asCurrencyFormat)(format))
        // Filter out any formats that didn't pass the cleaner assertion
        .filter(
          (format?: CurrencyFormat): format is CurrencyFormat => format != null
        )

      if (walletFormats.length === 0) {
        throw new Error('Missing wallet public keys')
      }
      const primaryFormat = getPrimaryFormat(
        engineInfo.formats ?? [],
        walletFormats
      )

      return {
        id,
        type,
        keys: {
          primaryFormat,
          walletFormats,
          publicKey
        }
      }
    }

    const privateKey = asMaybe(asCurrencyPrivateKey)(walletInfo.keys)
    if (privateKey != null) {
      const publicKey = deriveXpubsFromKeys({
        privateKey,
        coin: coinInfo.name
      })
      const walletFormats = getSupportedFormats(privateKey.format)

      return {
        id,
        type,
        keys: {
          // Private key format is the primary format because it was determined
          // during `createPrivateKey` phase.
          primaryFormat: privateKey.format,
          walletFormats,
          publicKey: { publicKeys: publicKey }
        }
      }
    }

    // If we get here, nothing matched:
    throw new Error('Either a public or private key are required')
  }
}
