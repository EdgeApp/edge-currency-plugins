import * as bip39 from 'bip39'
import { EdgeEncodeUri, EdgeIo, EdgeParsedUri, EdgeWalletInfo } from 'edge-core-js'
import { JsonObject } from 'edge-core-js/lib/types'
import { EdgeCurrencyTools } from 'edge-core-js/lib/types/types'

import { EngineCurrencyInfo, EngineCurrencyType, NetworkEnum } from './types'
import * as pluginUtils from './utils'
import * as utxoUtils from '../utxobased/plugin/utils'

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export function makeCurrencyTools(io: EdgeIo, currencyInfo: EngineCurrencyInfo): EdgeCurrencyTools {
  const fns: EdgeCurrencyTools = {
    async createPrivateKey(walletType: string, opts?: JsonObject): Promise<JsonObject> {
      const mnemonicKey = pluginUtils.getMnemonicKey({ coin: currencyInfo.network })
      const mnemonic = bip39.entropyToMnemonic(Buffer.from(io.random(32)))
      const keys: JsonObject = {
        [mnemonicKey]: mnemonic,
      }

      switch (currencyInfo.currencyType) {
        case EngineCurrencyType.UTXO:
          return {
            ...keys,
            format: opts?.format ?? currencyInfo.formats?.[0] ?? 'bip44',
            coinType: opts?.coinType ?? currencyInfo.coinType ?? 0
          }
      }
    },

    async derivePublicKey(walletInfo: EdgeWalletInfo): Promise<JsonObject> {
      let key = 'publicKey'
      let publicKey: string
      switch (currencyInfo.currencyType) {
        case EngineCurrencyType.UTXO:
          key = utxoUtils.getXpubKey({ coin: currencyInfo.network })
          // TODO: which xpub should be saved? the root path (m) or hardened path with the wallet format path (m/{purpose}'/{coinType}'/{account}')?
          publicKey = utxoUtils.deriveXpubFromKeys({
            keys: walletInfo.keys,
            coin: currencyInfo.network,
            network: NetworkEnum.Mainnet
          })
      }
      walletInfo.keys[key] = publicKey
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
