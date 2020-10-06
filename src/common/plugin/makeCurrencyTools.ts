import { EdgeCurrencyTools, EdgeEncodeUri, EdgeIo, EdgeParsedUri, EdgeWalletInfo } from 'edge-core-js'
import { JsonObject } from 'edge-core-js/lib/types'

import { NetworkEnum } from '../utxobased/keymanager/keymanager'
import { Account, IAccountConfig, makeAccount, makePrivateAccount, makePrivateAccountFromMnemonic } from '../Account'
import { EngineCurrencyInfo } from './types'
import { BIP43NameToPurposeType } from '../Path'

export function deriveAccount(currencyInfo: EngineCurrencyInfo, walletInfo: EdgeWalletInfo): Account {
  const config: IAccountConfig = {
    purpose: BIP43NameToPurposeType[walletInfo.keys.format],
    coinName: currencyInfo.network,
    networkType: NetworkEnum.Mainnet
  }

  const key = walletInfo.keys[`${currencyInfo.network}Key`]
  const keyPrefix = key.substr(1)
  if (keyPrefix.startsWith('pub')) {
    return makeAccount(key, config)
  } else if (keyPrefix.startsWith('prv')) {
    return makePrivateAccount(key, config)
  } else {
    return makePrivateAccountFromMnemonic(key, config)
  }
}

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export function makeCurrencyTools(io: EdgeIo, currencyInfo: EngineCurrencyInfo): EdgeCurrencyTools {
  const fns: EdgeCurrencyTools = {
    async createPrivateKey(walletType: string, opts?: JsonObject): Promise<JsonObject> {
      return {}
    },

    async derivePublicKey(walletInfo: EdgeWalletInfo) {
      const keys = walletInfo.keys
      const account = deriveAccount(currencyInfo, walletInfo)

      return {
        ...keys,
        [`${currencyInfo.network}Key`]: account.xpub
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
