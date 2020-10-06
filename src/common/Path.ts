import {
  AddressTypeEnum,
  BIP43PurposeTypeEnum,
  ScriptTypeEnum
} from './utxobased/keymanager/keymanager'

export const BIP43NameToPurposeType: { [format: string]: BIP43PurposeTypeEnum } = {
  bip44: BIP43PurposeTypeEnum.Legacy,
  bip49: BIP43PurposeTypeEnum.WrappedSegwit,
  bip84: BIP43PurposeTypeEnum.Segwit
}

export const BIP43PurposeTypeToName: { [type: string]: string } = {
  [BIP43PurposeTypeEnum.Legacy]: 'bip44',
  [BIP43PurposeTypeEnum.WrappedSegwit]: 'bip49',
  [BIP43PurposeTypeEnum.Segwit]: 'bip84'
}

const REGEX = /^m[/_](\d\d?)(?:(?:'\/)|(?:__))(\d)(?:(?:'\/)|(?:__))(\d+)['_]?(?:(?:[/_]([01]))(?:(?:(?:\/)|(?:___))(\d+))?)?$/

interface IPathConfig {
  purpose: BIP43PurposeTypeEnum
  coin: number
  account?: number
  change?: number
  index?: number
}

interface IPathValues extends Required<IPathConfig> {
  addressType: AddressTypeEnum
  scriptType: ScriptTypeEnum
}

export interface Path extends IPathValues {
  clone(): Path

  goTo(index: number, change?: number): this

  goToChange(change: number): this

  next(change?: number): this

  toAccount(normalize?: boolean): string

  toChange(normalize?: boolean): string

  toString(normalize?: boolean): string
}

export function normalizePath(path: string): string {
  return path.replace(REGEX, (_, purpose, coin, account, change, index) => {
    let str = `m_${purpose}__${coin}__${account}`
    if (change != null) {
      str += `__${change}`
      if (index != null) str += `___${index}`
    }
    return str
  })
}

export function makePathFromString(path: string): Path {
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

  return makePath({ purpose, coin, account, change, index })
}

export function makePath(config: IPathConfig): Path {
  let scriptType: ScriptTypeEnum
  let addressType: AddressTypeEnum

  switch (config.purpose) {
    case BIP43PurposeTypeEnum.Legacy:
      scriptType = ScriptTypeEnum.p2pkh
      addressType = AddressTypeEnum.p2pkh
      break

    case BIP43PurposeTypeEnum.WrappedSegwit:
      scriptType = ScriptTypeEnum.p2wpkhp2sh
      addressType = AddressTypeEnum.p2sh
      break

    case BIP43PurposeTypeEnum.Segwit:
    default:
      scriptType = ScriptTypeEnum.p2wpkh
      addressType = AddressTypeEnum.p2wpkh
  }

  const path: Path = {
    account: 0,
    change: 0,
    index: 0,
    ...config,
    scriptType,
    addressType,

    clone(): Path {
      return makePath(path)
    },

    goTo(index: number, change = path.change): Path {
      path.index = index
      path.change = change
      return path
    },

    goToChange(change: number): Path {
      return path.goTo(path.index, change)
    },

    next(change = path.change): Path {
      return path.goTo(path.index + 1, change)
    },

    toAccount(normalize = false): string {
      const typeNum = BIP43PurposeTypeToName[path.purpose].replace('bip', '')
      const pathStr = `m/${typeNum}'/${path.coin}'/${path.account}'`
      return normalize ? normalizePath(pathStr) : pathStr
    },

    toChange(normalize = false): string {
      const pathStr = `${path.toAccount()}/${path.change}`
      return normalize ? normalizePath(pathStr) : pathStr
    },

    toString(normalize = false): string {
      const pathStr = `${path.toChange()}/${path.index}`
      return normalize ? normalizePath(pathStr) : pathStr
    }
  }

  return path
}
