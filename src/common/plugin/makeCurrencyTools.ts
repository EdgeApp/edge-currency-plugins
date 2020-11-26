import { EdgeCurrencyTools, EdgeEncodeUri, EdgeIo, EdgeParsedUri, EdgeWalletInfo } from 'edge-core-js'
import { JsonObject } from 'edge-core-js/lib/types'

import {
  Account,
  PrivateAccount,
} from '../Account'
import { EngineCurrencyInfo } from './types'

export function deriveAccount(currencyInfo: EngineCurrencyInfo, walletInfo: EdgeWalletInfo): Account | PrivateAccount {
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

      return {
        ...keys,
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
