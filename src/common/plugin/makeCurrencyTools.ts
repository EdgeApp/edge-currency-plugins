import * as bip39 from 'bip39'
import {
  EdgeCurrencyTools,
  EdgeEncodeUri,
  EdgeIo,
  EdgeMetadata,
  EdgeParsedUri,
  EdgeWalletInfo,
  JsonObject
} from 'edge-core-js'
import * as bn from 'biggystring'
import urlParse from 'url-parse'

import { EngineCurrencyInfo, EngineCurrencyType, NetworkEnum } from './types'
import * as pluginUtils from './utils'
import * as utxoUtils from '../utxobased/engine/utils'

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
        [mnemonicKey]: mnemonic
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

    async parseUri(uri: string): Promise<EdgeParsedUri> {
      const uriObj = urlParse(uri, {}, true)
      const protocol = uriObj.protocol.replace(':', '').toLowerCase()

      // If the currency URI belongs to the wrong network then error
      if (protocol && (protocol !== currencyInfo.pluginId && protocol !== currencyInfo.uriPrefix && protocol !== 'pay')) {
        throw new Error('InvalidUriError')
      }

      // Get all possible query params
      const { pathname, query } = uriObj
      // If we don't have a pathname or a paymentProtocolURL uri then we bail
      if (!pathname && !query.r) throw new Error('InvalidUriError')

      // Create the returned object
      const parsedUri: EdgeParsedUri = {}
      // Parse the pathname and add it to the result object
      if (pathname) {
        if (currencyInfo.currencyType === EngineCurrencyType.UTXO) {
          const parsedPath = utxoUtils.parsePathname({
            pathname: uriObj.pathname,
            coin: currencyInfo.network,
            network: NetworkEnum.Mainnet
          })
          if (!parsedPath) throw new Error('InvalidUriError')

          Object.assign(parsedUri, parsedPath)
        }
      }

      // Assign the query params to the parsedUri object
      const metadata: EdgeMetadata = {}
      if (query.label) metadata.name = query.label
      if (query.message) metadata.notes = query.message
      if (query.category) metadata.category = query.category
      if (query.r) parsedUri.paymentProtocolUrl = query.r
      Object.assign(parsedUri, { metadata })

      // Get amount in native denomination if exists
      const denomination = currencyInfo.denominations.find(({ name }) =>
        name === currencyInfo.currencyCode
      )
      if (denomination && query.amount) {
        const { multiplier = '1' } = denomination
        const t = bn.mul(query.amount, multiplier.toString())
        parsedUri.currencyCode = currencyInfo.currencyCode
        parsedUri.nativeAmount = bn.toFixed(t, 0, 0)
      }
      return parsedUri
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
