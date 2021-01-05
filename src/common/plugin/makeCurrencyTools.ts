import * as bip39 from 'bip39'
import { EdgeEncodeUri, EdgeIo, EdgeParsedUri, EdgeWalletInfo } from 'edge-core-js'
import { JsonObject } from 'edge-core-js/lib/types'

import { NetworkEnum, seedOrMnemonicToXPriv, xprivToXPub } from '../utxobased/keymanager/keymanager'
import { EngineCurrencyInfo } from './types'
import { EdgeCurrencyTools } from 'edge-core-js/lib/types/types'
import { getMnemonicKey, getPurposeType, getXpubKey } from './makeWalletTools'

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export function makeCurrencyTools(io: EdgeIo, currencyInfo: EngineCurrencyInfo): EdgeCurrencyTools {
  const mnemonicKey = getMnemonicKey(currencyInfo)
  const xpubKey = getXpubKey(currencyInfo)

  const fns: EdgeCurrencyTools = {
    async createPrivateKey(walletType: string, opts?: JsonObject): Promise<JsonObject> {
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
      const args = {
        network: NetworkEnum.Mainnet,
        type: getPurposeType(walletInfo),
        coin: currencyInfo.network
      }
      const xpriv = seedOrMnemonicToXPriv({
        ...args,
        seed: walletInfo.keys[mnemonicKey],
        coinType: walletInfo.keys.coinType
      })
      const xpub = xprivToXPub({
        ...args,
        xpriv
      })
      return {
        [xpubKey]: xpub
      }
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
