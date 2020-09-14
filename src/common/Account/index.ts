import {
  AddressTypeEnum,
  BIP43PurposeTypeEnum,
  NetworkEnum,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  ScriptTypeEnum,
  xpubToPubkey
} from '../utxobased/keymanager/keymanager'
import { Path } from './Path'

export interface IAccountConfig {
  xpub: string
  coin: string
  type: BIP43PurposeTypeEnum
  network: NetworkEnum
}

export class Account {
  public xpub: string
  public coin: string
  public type: BIP43PurposeTypeEnum
  public network: NetworkEnum
  public addressType: AddressTypeEnum
  public scriptType: ScriptTypeEnum
  public path: Path

  constructor(config: IAccountConfig) {
    this.xpub = config.xpub
    this.coin = config.coin
    this.type = config.type
    this.network = config.network
    this.path = new Path({ type: config.type, account: 0 })

    switch (this.type) {
      case BIP43PurposeTypeEnum.Legacy:
        this.scriptType = ScriptTypeEnum.p2pkh
        this.addressType = AddressTypeEnum.p2pkh
        break

      case BIP43PurposeTypeEnum.WrappedSegwit:
        this.scriptType = ScriptTypeEnum.p2wpkhp2sh
        this.addressType = AddressTypeEnum.p2sh
        break

      case BIP43PurposeTypeEnum.Segwit:
      default:
        this.scriptType = ScriptTypeEnum.p2wpkh
        this.addressType = AddressTypeEnum.p2wpkh
    }
  }

  public getPubKey(path = this.path): string {
    return xpubToPubkey({
      xpub: this.xpub,
      network: this.network,
      type: this.type,
      bip44AddressIndex: path.index,
      bip44ChangeIndex: path.external ? 0 : 1,
      coin: 'bitcoin'
    })
  }

  public getScriptPubKey(path = this.path): string {
    return pubkeyToScriptPubkey({
      pubkey: this.getPubKey(path),
      scriptType: this.scriptType
    }).scriptPubkey
  }

  public getAddress(path = this.path): string {
    return scriptPubkeyToAddress({
      scriptPubkey: this.getScriptPubKey(path),
      network: path.network,
      addressType: this.addressType,
      coin: 'bitcoin'
    })
  }
}
