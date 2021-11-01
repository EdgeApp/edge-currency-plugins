import * as bn from 'biggystring'
import * as bip39 from 'bip39'
import {
  EdgeCurrencyTools,
  EdgeEncodeUri,
  EdgeIo,
  EdgeMetadata,
  EdgeMetaToken,
  EdgeParsedUri,
  EdgeWalletInfo,
  JsonObject
} from 'edge-core-js/types'
import * as uri from 'uri-js'
import urlParse from 'url-parse'

import * as utxoUtils from '../utxobased/engine/utils'
import { CurrencyFormatKeys } from '../utxobased/engine/utils'
import { NetworkEnum, PluginInfo } from './types'
import * as pluginUtils from './utils'

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export function makeCurrencyTools(
  io: EdgeIo,
  pluginInfo: PluginInfo
): EdgeCurrencyTools {
  const { currencyInfo, engineInfo } = pluginInfo

  const fns: EdgeCurrencyTools = {
    async createPrivateKey(
      walletType: string,
      opts?: JsonObject
    ): Promise<JsonObject> {
      const mnemonicKey = pluginUtils.getMnemonicKey({
        coin: engineInfo.network
      })
      const mnemonic = bip39.entropyToMnemonic(Buffer.from(io.random(32)))
      const keys: JsonObject = {
        [mnemonicKey]: mnemonic
      }

      return {
        ...keys,
        format: opts?.format ?? engineInfo.formats?.[0] ?? 'bip44',
        coinType: opts?.coinType ?? engineInfo.coinType ?? 0
      }
    },

    async derivePublicKey(walletInfo: EdgeWalletInfo): Promise<JsonObject> {
      const key = utxoUtils.getXpubKey({ coin: engineInfo.network })
      // TODO: which xpub should be saved? the root path (m) or hardened path with the wallet format path (m/{purpose}'/{coinType}'/{account}')?
      const publicKey: CurrencyFormatKeys = utxoUtils.deriveXpubsFromKeys({
        keys: walletInfo.keys,
        coin: engineInfo.network,
        network: engineInfo.networkType ?? NetworkEnum.Mainnet
      })
      walletInfo.keys[key] = publicKey
      return walletInfo.keys
    },

    async parseUri(uri: string): Promise<EdgeParsedUri> {
      const uriObj = urlParse(uri, {}, true)
      const protocol = uriObj.protocol.replace(':', '').toLowerCase()

      // If the currency URI belongs to the wrong network then error
      if (
        protocol !== '' &&
        protocol !== currencyInfo.pluginId &&
        protocol !== engineInfo.uriPrefix &&
        protocol !== 'pay'
      ) {
        throw new Error('InvalidUriError')
      }

      // Get all possible query params
      const { pathname, query } = uriObj
      // If we don't have a pathname or a paymentProtocolURL uri then we bail
      if (pathname === '' && query.r == null) throw new Error('InvalidUriError')

      // Create the returned object
      const parsedUri: EdgeParsedUri = {}
      // Parse the pathname and add it to the result object
      if (pathname !== '') {
        const parsedPath = utxoUtils.parsePathname({
          pathname: uriObj.pathname,
          coin: engineInfo.network,
          network: engineInfo.networkType ?? NetworkEnum.Mainnet
        })
        if (parsedPath == null) throw new Error('InvalidUriError')

        Object.assign(parsedUri, parsedPath)
      }

      // Assign the query params to the parsedUri object
      const metadata: EdgeMetadata = {}
      if (query.label != null) metadata.name = query.label
      if (query.message != null) metadata.notes = query.message
      if (query.category != null) metadata.category = query.category
      if (query.r != null) parsedUri.paymentProtocolUrl = query.r
      Object.assign(parsedUri, { metadata })

      // Get amount in native denomination if exists
      const denomination = currencyInfo.denominations.find(
        ({ name }) => name === currencyInfo.currencyCode
      )
      if (denomination != null && query.amount != null) {
        const { multiplier = '1' } = denomination
        const t = bn.mul(query.amount, multiplier.toString())
        parsedUri.currencyCode = currencyInfo.currencyCode
        parsedUri.nativeAmount = bn.toFixed(t, 0, 0)
      }
      return parsedUri
    },

    async encodeUri(
      obj: EdgeEncodeUri,
      _customTokens?: EdgeMetaToken[]
    ): Promise<string> {
      const { publicAddress } = obj
      if (publicAddress === '') {
        throw new Error('InvalidPublicAddressError')
      }

      // TODO: validate network address

      const query: string[] = []

      if (obj.nativeAmount != null) {
        const currencyCode = obj.currencyCode ?? currencyInfo.currencyCode
        const denomination = currencyInfo.denominations.find(
          ({ name }) => name === currencyCode
        )
        if (denomination == null) {
          throw new Error('InvalidDenominationError')
        }

        const amount = bn.div(obj.nativeAmount, denomination.multiplier, 8)
        query.push(`amount=${amount}`)
      }

      if (obj.label != null) {
        query.push(`label=${obj.label}`)
      }

      if (obj.message != null) {
        query.push(`message=${obj.message}`)
      }

      return query.length > 0
        ? uri.serialize({
            scheme: engineInfo.uriPrefix ?? currencyInfo.pluginId,
            path: publicAddress,
            query: query.join('&')
          })
        : publicAddress
    },

    getSplittableTypes(walletInfo: EdgeWalletInfo): string[] {
      const { keys: { format = 'bip32' } = {} } = walletInfo
      const forks = engineInfo.forks ?? []

      return forks
        .filter(({ engineInfo: { formats } }) => formats?.includes(format))
        .map(({ currencyInfo: { walletType } }) => walletType)
    }
  }

  return fns
}
