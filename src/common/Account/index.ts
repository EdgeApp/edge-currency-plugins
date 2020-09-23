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
import { getCoinFromString } from '../utxobased/keymanager/coinmapper'

export interface IAccountConfig {
  xpub: string
  purpose: BIP43PurposeTypeEnum
  coinName: string
  networkType: NetworkEnum
}

export class Account {
  public xpub: string
  public purpose: BIP43PurposeTypeEnum
  public coin: number
  public coinName: string
  public networkType: NetworkEnum
  public addressType: AddressTypeEnum
  public scriptType: ScriptTypeEnum
  public path: Path

  constructor(config: IAccountConfig) {
    this.xpub = config.xpub
    this.purpose = config.purpose
    this.coinName = config.coinName
    this.coin = getCoinFromString(this.coinName).coinType
    this.networkType = config.networkType
    this.path = new Path({ purpose: config.purpose, coin: this.coin })

    switch (this.purpose) {
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
      network: this.networkType,
      type: this.purpose,
      bip44AddressIndex: path.index,
      bip44ChangeIndex: path.change ? 0 : 1,
      coin: this.coinName
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
      network: this.networkType,
      addressType: this.addressType,
      coin: this.coinName
    })
  }
}
