import {
  AddressTypeEnum,
  BIP43NameToPurposeType,
  BIP43PurposeTypeEnum,
  BIP43PurposeTypeToName,
  ScriptTypeEnum
} from './utxobased/keymanager/keymanager'
import { getCoinFromString } from './utxobased/keymanager/coinmapper'

const PathRegExpStart = /^m[/_](\d+)/
const RemaningRegExp = /(?:(?:'\/)|(?:__))(\d+)(?:(?:'\/)|(?:__))(\d+)['_]?(?:(?:[/_]([01]))(?:(?:(?:\/)|(?:___))(\d+))?)?$/
const RemaningAribitzRegExp = /[\/_]0(?:(?:(?:\/)|(?:___))(\d+))?$/
const REGEX = new RegExp(PathRegExpStart.source + RemaningRegExp.source)
const AIRBITZ_REGEX = new RegExp(PathRegExpStart.source + RemaningAribitzRegExp.source)

interface IPathConfig {
  purpose: BIP43PurposeTypeEnum
  change?: 0 | 1
  index?: number
}

interface ICoinConfig extends IPathConfig {
  coin: number
}

interface ICoinNameConfig extends IPathConfig {
  coinName: string
}

interface IPathValues extends Required<ICoinConfig> {
  addressType: AddressTypeEnum
  scriptType: ScriptTypeEnum
}

export interface Path extends IPathValues {
  clone(): Path

  getChangePath(): Path | void

  isChangePath(): boolean

  goTo(index: number): this

  next(): this

  toAccount(normalize?: boolean): string

  toPrefix(normalize?: boolean): string

  toString(normalize?: boolean): string
}

const InvalidPathError = new Error('Invalid path')

export const toPurposeType = (path: string | Path): BIP43PurposeTypeEnum => {
  if (typeof path !== 'string') {
    path = path.toString()
  }

  if (AIRBITZ_REGEX.test(path)) {
    return BIP43PurposeTypeEnum.Airbitz
  }

  const match = path.match(PathRegExpStart)
  if (!match) {
    throw InvalidPathError
  }

  return BIP43NameToPurposeType[`bip${match[1]}`]
}

export function normalizePath(path: string): string {
  const purpose = toPurposeType(path)
  let normalizedPath: string

  if (purpose === BIP43PurposeTypeEnum.Airbitz) {
    normalizedPath = path.replace(AIRBITZ_REGEX, (_, __, index) => {
      let str = `m_0_0`
      if (index != null) {
        str += `___${index}`
      }
      return str
    })
  } else {
    normalizedPath = path.replace(REGEX, (_, purpose, coin, _account, change, index) => {
      let str = `m_${purpose}__${coin}__0`
      if (change != null) {
        str += `__${change}`
        if (index != null) str += `___${index}`
      }
      return str
    })
  }

  if (normalizedPath.includes('/')) {
    throw InvalidPathError
  }

  return normalizedPath
}

export const makePathFromString = (pathStr: string): Path => {
  let path: Path

  try {
    path = makePathFromBip43String(pathStr)
  } catch (e) {
    path = makePathFromAirbitzString(pathStr)
  }

  return path
}

const makePathFromBip43String = (path: string): Path => {
  const match = path.match(REGEX)
  if (match == null) throw InvalidPathError

  const [ _, _purpose, _coin, _account, _change = '0', _index = '0' ] = match

  if (_purpose == null) throw InvalidPathError
  const purpose = BIP43NameToPurposeType[`bip${_purpose}`]

  if (_coin == null) throw InvalidPathError
  const coin = parseInt(_coin)

  const change = <0|1>parseInt(_change)
  if (change < 0 || change > 1) throw InvalidPathError

  const index = parseInt(_index)

  return makePath({ purpose, coin, change, index })
}

const makePathFromAirbitzString = (path: string): Path => {
  const match = path.match(AIRBITZ_REGEX)
  if (match == null) throw InvalidPathError

  const [ _, __, _index = '0' ] = match

  const purpose = BIP43PurposeTypeEnum.Airbitz

  const coin = 0

  const index = parseInt(_index)

  return makePath({ purpose, coin, index })
}

export function makePath(config: ICoinConfig): Path
export function makePath(config: ICoinNameConfig): Path
export function makePath(config: ICoinConfig | ICoinNameConfig): Path {
  let {
    purpose,
    change = 0,
    index = 0,
  } = config

  if (purpose === BIP43PurposeTypeEnum.Airbitz && change != 0) {
    change = 0
  }

  let coin = 'coin' in config
    ? config.coin
    : getCoinFromString(config.coinName).coinType

  let scriptType: ScriptTypeEnum
  let addressType: AddressTypeEnum
  switch (config.purpose) {
    case BIP43PurposeTypeEnum.Airbitz:
      scriptType = ScriptTypeEnum.p2pkh
      addressType = AddressTypeEnum.p2pkh
      break

    case BIP43PurposeTypeEnum.Legacy:
      scriptType = ScriptTypeEnum.p2pkh
      addressType = AddressTypeEnum.p2pkh
      break

    case BIP43PurposeTypeEnum.WrappedSegwit:
      scriptType = ScriptTypeEnum.p2wpkhp2sh
      addressType = AddressTypeEnum.p2sh
      break

    case BIP43PurposeTypeEnum.Segwit:
      scriptType = ScriptTypeEnum.p2wpkh
      addressType = AddressTypeEnum.p2wpkh
  }

  const path: Path = {
    get purpose(): BIP43PurposeTypeEnum {
      return purpose
    },

    get change(): 0 | 1 {
      return change
    },

    get index(): number {
      return index
    },

    get coin(): number {
      return coin
    },

    get scriptType(): ScriptTypeEnum {
      return scriptType
    },

    get addressType(): AddressTypeEnum {
      return addressType
    },

    clone(): Path {
      return makePath(path)
    },

    getChangePath(): Path | void {
      if (purpose !== BIP43PurposeTypeEnum.Airbitz) {
        return makePath({ ...config, coin, change: 1 })
      }
    },

    isChangePath(): boolean {
      return change === 1
    },

    goTo(newIndex: number): Path {
      index = newIndex
      return path
    },

    next(): Path {
      return path.goTo(index + 1)
    },

    toAccount(normalize = false): string {
      let pathStr: string
      if (path.purpose === BIP43PurposeTypeEnum.Airbitz) {
        pathStr = `m/0/0`
      } else {
        const typeNum = BIP43PurposeTypeToName[purpose].replace('bip', '')
        pathStr = `m/${typeNum}'/${coin}'/0'`
      }

      return normalize ? normalizePath(pathStr) : pathStr
    },

    toPrefix(normalize = false): string {
      let pathStr = path.toAccount()
      if (purpose !== BIP43PurposeTypeEnum.Airbitz) {
        pathStr += `/${change}`
      }
      return normalize ? normalizePath(pathStr) : pathStr
    },

    toString(normalize = false): string {
      const pathStr = `${path.toPrefix()}/${index}`
      return normalize ? normalizePath(pathStr) : pathStr
    }
  }

  return path
}
