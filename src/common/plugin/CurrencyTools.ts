import { Buffer } from 'buffer'
import {
  EdgeCreatePrivateKeyOptions,
  EdgeCurrencyTools,
  EdgeEncodeUri,
  EdgeIo,
  EdgeParsedUri,
  EdgeWalletInfo
} from 'edge-core-js'

import { PrivateAccount } from '../Account/PrivateAccount'
import { BIP43FormatToType } from '../utxobased/keymanager/keymanager'
import { EngineCurrencyInfo } from './CurrencyEngine'
import { Account } from '../Account'
import { JsonObject } from 'edge-core-js/lib/types'

/**
 * The core currency plugin.
 * Provides information about the currency,
 * as well as generic (non-wallet) functionality.
 */
export class CurrencyTools implements EdgeCurrencyTools {
  constructor(
    private readonly io: EdgeIo,
    public readonly currencyInfo: EngineCurrencyInfo
  ) {}

  public get pluginId() {
    return this.currencyInfo.pluginId
  }

  public get network() {
    return this.currencyInfo.network
  }

  private get mnemonicKey() {
    return `${this.network}Key`
  }

  public async createPrivateKey(walletType: string, opts?: JsonObject): Promise<JsonObject> {
    return {}
  }

  public async derivePublicKey(walletInfo: EdgeWalletInfo) {
    const keys = walletInfo.keys
    const account = this.deriveAccount(walletInfo)

    return {
      ...keys,
      [this.mnemonicKey]: account.xpub
    }
  }

  public getPrivateSeed(walletInfo: EdgeWalletInfo): string {
    const mnemonicKey = `${this.network}Key`
    return walletInfo.keys[mnemonicKey]
  }

  public deriveAccount(walletInfo: EdgeWalletInfo): PrivateAccount {
    const mnemonic = this.getPrivateSeed(walletInfo)
    return PrivateAccount.fromMnemonic(mnemonic, {
      coin: this.network,
      network: walletInfo.keys.coinType,
      type: BIP43FormatToType[walletInfo.keys.format]
    })
  }

  public buildAccount(walletInfo: EdgeWalletInfo): Account {
    return new Account({
      xpub: walletInfo.keys[`${this.network}Key`],
      coin: this.network,
      network: walletInfo.keys.coinType,
      type: BIP43FormatToType[walletInfo.keys.format]
    })
  }

  public parseUri(uri: string): Promise<EdgeParsedUri> {
    return Promise.resolve({})
  }

  public encodeUri(obj: EdgeEncodeUri): Promise<string> {
    return Promise.resolve('')
  }

  public getSplittableTypes(_walletInfo: EdgeWalletInfo): string[] {
    return []
  }
}
