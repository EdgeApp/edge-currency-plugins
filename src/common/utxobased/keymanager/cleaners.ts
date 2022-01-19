import {
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
      const asCoinType = asOptional(asNumber, coinType)
      return {
        coinType: asCoinType(raw.coinType),
        format: asOptionalPrivateKeyFormat(raw.format),
        seed: asString(raw[`${coinName}Key`])
      }
    },
    clean => {
      const { coinType, format, seed } = clean
      return {
        coinType,
        format,
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
      return ['bip49', 'bip84']
    case 'bip84':
      return ['bip49', 'bip84']
    default:
      throw new Error(`Unsupported format ${format}`)
  }
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
    primaryFormat: CurrencyFormat
    walletFormats: CurrencyFormat[]
    publicKey: PublicKey
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

      // Search the engineInfo's formats array for the first format that exists
      // in the publicKey data.
      // If there are no defined formats in the engineInfo, then fallback to the
      // first format in the publicKey after sorting alphabetically.
      const primaryFormat =
        (engineInfo.formats != null && engineInfo.formats.length > 0
          ? engineInfo.formats.find(format => walletFormats.includes(format))
          : undefined) ??
        walletFormats.sort((a, b) => (a === b ? 0 : a > b ? 1 : -1))[0]

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
