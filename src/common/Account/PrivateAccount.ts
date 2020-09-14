import {
  mnemonicToXPriv,
  xprivToXPub
} from '../utxobased/keymanager/keymanager'
import { Account, IAccountConfig } from '.'
import { Path } from './Path'

export type PrivateAccountConfig = Omit<IAccountConfig, 'xpub'>

export class PrivateAccount extends Account {
  constructor(public xpriv: string, config: PrivateAccountConfig) {
    super({
      ...config,
      xpub: xprivToXPub({
        xpriv,
        network: config.network,
        type: config.type,
        coin: config.coin
      })
    })
  }

  public static fromMnemonic(
    mnemonic: string,
    config: PrivateAccountConfig
  ): PrivateAccount {
    const path = new Path({ type: config.type, account: 0 })
    const xpriv = mnemonicToXPriv({
      ...config,
      mnemonic,
      path: path.toAccount()
    })
    return new PrivateAccount(xpriv, config)
  }
}
