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
  EngineInfo,
  PluginInfo
} from '../../plugin/types'
import { deriveXpubsFromKeys } from '../engine/utils'

// Private key format are a strict subset of all currency formats
type PrivateKeyFormat = ReturnType<typeof asPrivateKeyFormat>
const asPrivateKeyFormat = asValue('bip32', 'bip44', 'bip49')
// Default to bip32 always for legacy reasons
const asOptionalPrivateKeyFormat = asOptional(asPrivateKeyFormat, 'bip32')

/**
 * A cleaner for the private key format following the key-formats specification.
 * It _includes_ the private key.
 *
 * **It is not considered safe memory, and it should be deallocated
 * (thrown away) after use**.
 *
 * (spec: https://github.com/EdgeApp/edge-core-js/blob/master/docs/key-formats.md)
 */
export interface PrivateKey {
  coinType: number
  format: PrivateKeyFormat
  imported?: boolean
  seed: string // rename of seed/mnemonic (i.e. bitcoinKey, litecoinKey, etc)
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
 * This utility returns a wallet's supported formats according to its
 * private-key's format as specified in the key-formats specification.
 */
export const getSupportedFormats = (
  engineInfo: EngineInfo,
  privateKeyFormat: PrivateKeyFormat
): CurrencyFormat[] => {
  const formats = ((): CurrencyFormat[] => {
    switch (privateKeyFormat) {
      case 'bip32':
        return ['bip32']
      case 'bip44':
        return ['bip44']
      case 'bip49':
        return ['bip49', 'bip84']
    }
  })()
  const engineInfoFormats = engineInfo.formats ?? ['bip44', 'bip32']
  return formats.filter(format => engineInfoFormats.includes(format))
}

/**
 * Infers the private key format given a public key
 */

export const inferPrivateKeyFormat = (
  publicKey: PublicKey
): PrivateKeyFormat => {
  const supportedFormats: CurrencyFormat[] = []
  for (const [format, xpub] of Object.entries(publicKey.publicKeys)) {
    if (xpub != null) supportedFormats.push(format as CurrencyFormat)
  }
  if (supportedFormats.includes('bip49')) return 'bip49'
  if (supportedFormats.includes('bip44')) return 'bip44'
  if (supportedFormats.includes('bip32')) return 'bip32'
  return 'bip32'
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
 * The `privateKeyFormat` field is the format defined by the private key and is
 * useful for determining the "kind of wallet", or more precisely how the public
 * key (xpubs) formats were derived.
 */
export interface NumbWalletInfo {
  id: string
  type: string
  keys: {
    imported?: boolean
    privateKeyFormat: PrivateKeyFormat
    publicKey: PublicKey
    walletFormats: CurrencyFormat[]
  }
}
export const asNumbWalletInfo = (
  pluginInfo: PluginInfo
): Cleaner<NumbWalletInfo> => {
  return (walletInfo: EdgeWalletInfo): NumbWalletInfo => {
    const { coinInfo, engineInfo } = pluginInfo
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

      const privateKeyFormat = inferPrivateKeyFormat(publicKey)

      return {
        id,
        type,
        keys: {
          privateKeyFormat,
          walletFormats,
          publicKey
        }
      }
    }

    const privateKey = asMaybe(asCurrencyPrivateKey)(walletInfo.keys)
    if (privateKey != null) {
      const publicKey = deriveXpubsFromKeys({
        engineInfo,
        privateKey,
        coin: coinInfo.name
      })
      const walletFormats = getSupportedFormats(engineInfo, privateKey.format)

      return {
        id,
        type,
        keys: {
          privateKeyFormat: privateKey.format,
          walletFormats,
          publicKey: { publicKeys: publicKey }
        }
      }
    }

    // If we get here, nothing matched:
    throw new Error('Either a public or private key are required')
  }
}
