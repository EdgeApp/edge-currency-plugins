import {
  BIP43NameToPurposeType,
  BIP43PurposeTypeEnum, BIP43PurposeTypeToName
} from '../utxobased/keymanager/keymanager'

const REGEX = /^m[/_](\d\d?)(?:(?:'\/)|(?:__))(\d)(?:(?:'\/)|(?:__))(\d+)['_]?(?:(?:[/_]([01]))(?:(?:(?:\/)|(?:___))(\d+))?)?$/

interface IPathConfig {
  purpose: BIP43PurposeTypeEnum
  coin: number
  account?: number
  change?: number
  index?: number
}

export class Path {
  public purpose: BIP43PurposeTypeEnum
  public coin: number
  public account: number
  public change: number
  public index: number

  constructor(config: IPathConfig) {
    this.purpose = config.purpose
    this.coin = config.coin
    this.account = config.account ?? 0
    this.change = config.change ?? 0
    this.index = config.index ?? 0
  }

  public static fromPurpose(purpose: BIP43PurposeTypeEnum, coin: number): Path {
    return new Path({ purpose, coin })
  }

  public static fromString(path: string): Path {
    const err = new Error('Invalid path')

    const match = path.match(REGEX)
    if (match == null) throw err

    const [ _, _purpose, _coin, _account, _change = '0', _index = '0' ] = match

    if (_purpose == null) throw err
    const purpose = BIP43NameToPurposeType[`bip${_purpose}`]

    if (_coin == null) throw err
    const coin = parseInt(_coin)

    if (_account == null) throw err
    const account = parseInt(_account)

    const change = parseInt(_change)

    const index = parseInt(_index)

    return new Path({
      purpose,
      coin,
      account,
      change,
      index,
    })
  }

  public static normalize(path: string): string {
    return path.replace(REGEX, (_, purpose, coin, account, change, index) => {
      let str = `m_${purpose}__${coin}__${account}`
      if (change != null) {
        str += `__${change}`
        if (index != null) str += `___${index}`
      }
      return str
    })
  }

  public clone(): Path {
    return new Path({
      purpose: this.purpose,
      account: this.account,
      change: this.change,
      index: this.index,
      coin: this.coin
    })
  }

  public goTo(index: number, change: number = this.change): this {
    this.index = index
    this.change = change
    return this
  }

  public goToChange(change: number): this {
    return this.goTo(this.index, change)
  }

  public next(change?: number): this {
    return this.goTo(this.index + 1, change)
  }

  public toAccount(normalize = false): string {
    const typeNum = BIP43PurposeTypeToName[this.purpose].replace('bip', '')
    const path = `m/${typeNum}'/${this.coin}'/${this.account}'`
    return normalize ? Path.normalize(path) : path
  }

  public toChange(normalize = false): string {
    const path = `${this.toAccount()}/${this.change}`
    return normalize ? Path.normalize(path) : path
  }

  public toString(normalize = false): string {
    const path = `${this.toChange()}/${this.index}`
    return normalize ? Path.normalize(path) : path
  }
}
