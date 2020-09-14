import {
  BIP43FormatToType,
  BIP43PurposeTypeEnum, BIP43TypeToFormat,
  NetworkEnum
} from '../utxobased/keymanager/keymanager'

const CoinToNetwork: { [coin: string]: NetworkEnum } = {
  0: NetworkEnum.Mainnet,
  1: NetworkEnum.Testnet
}

const REGEX = /^m[/_](\d\d?)(?:(?:'\/)|(?:__))(\d)(?:(?:'\/)|(?:__))(\d+)['_]?(?:(?:[/_]([01]))(?:(?:(?:\/)|(?:___))(\d+))?)?$/

interface IPathConfig {
  type: BIP43PurposeTypeEnum
  account?: number
  external?: boolean
  index?: number
  network?: NetworkEnum
}

export class Path {
  public type: BIP43PurposeTypeEnum
  public account: number
  public external: boolean
  public index: number
  public network: NetworkEnum

  constructor(config: IPathConfig) {
    this.type = config.type
    this.account = config.account ?? 0
    this.external = config.external ?? true
    this.index = config.index ?? 0
    this.network = config.network ?? NetworkEnum.Mainnet
  }

  public static fromType(type: BIP43PurposeTypeEnum, account = 0): Path {
    return new Path({ type, account })
  }

  public static fromString(path: string): Path {
    const err = new Error('Invalid path')

    const match = path.match(REGEX)
    if (match == null) throw err

    const type = BIP43FormatToType[`bip${match[1]}`]
    if (type == null) throw err

    const network = CoinToNetwork[match[2]]
    if (network == null) throw err

    if (match[3] == null) throw err
    const account = parseInt(match[3])

    const external = match[4] === '0' || match[4] == null

    let index
    if (match[5] != null) index = parseInt(match[5])

    const config: IPathConfig = {
      type: type,
      account,
      external,
      index,
      network
    }

    return new Path(config)
  }

  public static normalize(path: string): string {
    return path.replace(REGEX, (_, type, coin, account, external, index) => {
      let str = `m_${type}__${coin}__${account}`
      if (external != null) {
        str += `__${external}`
        if (index != null) str += `___${index}`
      }
      return str
    })
  }

  public clone(): Path {
    return new Path({
      type: this.type,
      account: this.account,
      external: this.external,
      index: this.index,
      network: this.network
    })
  }

  public goTo(index: number, external?: boolean): this {
    this.index = index
    this.external = external ?? this.external
    return this
  }

  public next(external?: boolean): this {
    return this.goTo(this.index + 1, external)
  }

  public switch(external?: boolean): this {
    return this.goTo(this.index, external ?? !this.external)
  }

  public reset(external = true): this {
    return this.goTo(0, external)
  }

  public toAccount(normalize = false): string {
    const coin = this.network === NetworkEnum.Mainnet ? 0 : 1
    const typeNum = BIP43TypeToFormat[this.type].replace('bip', '')
    const path = `m/${typeNum}'/${coin}'/${this.account}'`
    return normalize ? Path.normalize(path) : path
  }

  public toChange(normalize = false): string {
    const change = this.external ? 0 : 1
    const path = `${this.toAccount()}/${change}`
    return normalize ? Path.normalize(path) : path
  }

  public toString(normalize = false): string {
    const path = `${this.toChange()}/${this.index}`
    return normalize ? Path.normalize(path) : path
  }
}
