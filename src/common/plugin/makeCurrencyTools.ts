import * as bip39 from 'bip39'
import { EdgeEncodeUri, EdgeIo, EdgeParsedUri, EdgeWalletInfo } from 'edge-core-js'
import { JsonObject } from 'edge-core-js/lib/types'
import { EdgeCurrencyTools } from 'edge-core-js/lib/types/types'

import { EngineCurrencyInfo, NetworkEnum } from './types'
import { deriveXpub, getMnemonicKey, getXpubKey } from './utils'

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export function makeCurrencyTools(io: EdgeIo, currencyInfo: EngineCurrencyInfo): EdgeCurrencyTools {
  const fns: EdgeCurrencyTools = {
    async createPrivateKey(walletType: string, opts?: JsonObject): Promise<JsonObject> {
      const mnemonicKey = getMnemonicKey({ coin: currencyInfo.network })
      const mnemonic = bip39.entropyToMnemonic(Buffer.from(io.random(32)))
      const format = opts?.format ?? currencyInfo.formats?.[0] ?? 'bip44'
      const coinType = opts?.coinType ?? currencyInfo.coinType ?? 0
      return {
        [mnemonicKey]: mnemonic,
        format,
        coinType
      }
    },

    async derivePublicKey(walletInfo: EdgeWalletInfo): Promise<JsonObject> {
      const xpubKey = getXpubKey({ coin: currencyInfo.network })
      walletInfo.keys[xpubKey] = deriveXpub({
        keys: walletInfo.keys,
        coin: currencyInfo.network,
        network: NetworkEnum.Mainnet
      })
      return walletInfo.keys
    },

    parseUri(uri: string): Promise<EdgeParsedUri> {
      return Promise.resolve({})
    },

    encodeUri(obj: EdgeEncodeUri): Promise<string> {
      return Promise.resolve('')
    },

    getSplittableTypes(_walletInfo: EdgeWalletInfo): string[] {
      return []
    }
  }

  return fns
}
