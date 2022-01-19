import * as bn from 'biggystring'
import * as bip39 from 'bip39'
import { uncleaner } from 'cleaners'
import {
  EdgeCurrencyTools,
  EdgeEncodeUri,
  EdgeIo,
  EdgeMetaToken,
  EdgeWalletInfo,
  JsonObject
} from 'edge-core-js/types'
import * as uri from 'uri-js'
import urlParse from 'url-parse'

import { parsePathname } from '../utxobased/engine/utils'
import {
  asNumbWalletInfo,
  asPrivateKey,
  PrivateKey
} from '../utxobased/keymanager/cleaners'
import { EncodeUriMetadata, ExtendedParseUri, PluginInfo } from './types'
import { getFormatsForNetwork } from './utils'

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export function makeCurrencyTools(
  io: EdgeIo,
  pluginInfo: PluginInfo
): EdgeCurrencyTools {
  const { currencyInfo, engineInfo, coinInfo } = pluginInfo

  const asCurrencyPrivateKey = asPrivateKey(coinInfo.name, coinInfo.coinType)
  const wasCurrencyPrivateKey = uncleaner(asCurrencyPrivateKey)
  const asCurrencyNumbWalletInfo = asNumbWalletInfo(pluginInfo)

  const fns: EdgeCurrencyTools = {
    async createPrivateKey(
      _walletType: string,
      opts?: JsonObject
    ): Promise<JsonObject> {
      const mnemonic = bip39.entropyToMnemonic(Buffer.from(io.random(32)))

      const privateKey: PrivateKey = {
        seed: mnemonic,
        format: opts?.format ?? engineInfo.formats?.[0] ?? 'bip44',
        coinType: opts?.coinType ?? coinInfo.coinType ?? 0
      }

      return wasCurrencyPrivateKey(privateKey)
    },

    async derivePublicKey(walletInfo: EdgeWalletInfo): Promise<JsonObject> {
      const numbWalletInfo = asCurrencyNumbWalletInfo(walletInfo)
      return numbWalletInfo.keys.publicKey
    },

    async parseUri(uri: string): Promise<ExtendedParseUri> {
      const isGateway = uri
        .toLocaleLowerCase()
        .startsWith(`${coinInfo.name}://`)
      if (isGateway) uri = uri.replace('//', '')

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
      const parsedUri: ExtendedParseUri = {}
      // Parse the pathname and add it to the result object
      if (pathname !== '') {
        const parsedPath = parsePathname({
          pathname: uriObj.pathname,
          coin: coinInfo.name
        })
        if (parsedPath == null) throw new Error('InvalidUriError')

        Object.assign(parsedUri, parsedPath)
      }

      // Assign the query params to the parsedUri object
      const metadata: ExtendedParseUri['metadata'] = {}
      if (query.label != null) metadata.name = query.label
      if (query.message != null) metadata.notes = query.message
      if (query.category != null) metadata.category = query.category
      if (query.r != null) parsedUri.paymentProtocolUrl = query.r
      if (isGateway) metadata.gateway = true
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
      obj: EdgeEncodeUri & EncodeUriMetadata,
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

      const metadata = obj.metadata
      if (metadata != null) {
        if (metadata.name != null) {
          query.push(`label=${metadata.name}`)
        }
        if (metadata.notes != null) {
          query.push(`message=${metadata.notes}`)
        }
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
        .filter(network => getFormatsForNetwork(network).includes(format))
        .map(network => `wallet:${network}`)
    }
  }

  return fns
}
