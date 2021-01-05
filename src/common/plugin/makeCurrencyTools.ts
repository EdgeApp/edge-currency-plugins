import * as bip39 from 'bip39'
import { EdgeCurrencyTools, EdgeEncodeUri, EdgeIo, EdgeParsedUri, EdgeWalletInfo } from 'edge-core-js'
import { JsonObject } from 'edge-core-js/lib/types'

import {
  bip43PurposeNumberToTypeEnum,
  NetworkEnum,
  seedOrMnemonicToXPriv,
  xprivToXPub
} from '../utxobased/keymanager/keymanager'
import {
  Account,
  IAccountConfig,
  makeAccount,
  makePrivateAccount,
  makePrivateAccountFromMnemonic,
  PrivateAccount
} from '../Account'
import { EngineCurrencyInfo } from './types'
import { BIP43NameToPurposeType } from '../Path'

export function deriveAccount(currencyInfo: EngineCurrencyInfo, walletInfo: EdgeWalletInfo): Account | PrivateAccount {
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
  const mnemonicKey = `${currencyInfo.network}Key`
  const xpubKey = `${currencyInfo.network}Xpub`

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
      const formatNum = (walletInfo.keys.format as string).replace('bip', '')
      const args = {
        network: NetworkEnum.Mainnet,
        type: bip43PurposeNumberToTypeEnum(Number(formatNum)),
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
