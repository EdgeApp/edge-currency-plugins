import {
  BIP43PurposeTypeEnum,
  mnemonicToXPriv,
  NetworkEnum,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  xprivToXPub,
  xpubToPubkey
} from './utxobased/keymanager/keymanager'
import { makePath, makePathFromString, Path } from './Path'
import { getCoinFromString } from './utxobased/keymanager/coinmapper'

export interface IAccountConfig {
  purpose: BIP43PurposeTypeEnum
  coinName: string
  networkType: NetworkEnum
}

export interface Account {
  xpub: string
  purpose: BIP43PurposeTypeEnum
  coin: number
  coinName: string
  networkType: NetworkEnum
  path: Path

  getPubKey(p?: Path): string

  getScriptPubKey(p?: Path): string

  getAddress(p?: Path): string

  getAddressFromPathString(path: string): string
}

export function makeAccount(xpub: string, config: IAccountConfig): Account {
  const purpose = config.purpose
  const coinName = config.coinName
  const coin = getCoinFromString(coinName).coinType
  const networkType = config.networkType
  const path = makePath({ purpose: config.purpose, coin })

  function getPubKey(p = path): string {
    return xpubToPubkey({
      xpub: xpub,
      network: networkType,
      type: purpose,
      bip44AddressIndex: p.index,
      bip44ChangeIndex: p.change ? 0 : 1,
      coin: coinName
    })
  }

  function getScriptPubKey(p = path): string {
    return pubkeyToScriptPubkey({
      pubkey: getPubKey(p),
      scriptType: p.scriptType
    }).scriptPubkey
  }

  function getAddress(p = path): string {
    return scriptPubkeyToAddress({
      scriptPubkey: getScriptPubKey(p),
      network: networkType,
      addressType: p.addressType,
      coin: coinName
    })
  }

  function getAddressFromPathString(path: string): string {
    return getAddress(makePathFromString(path))
  }

  return {
    xpub,
    purpose,
    coinName,
    coin,
    networkType,
    path,
    getPubKey,
    getScriptPubKey,
    getAddress,
    getAddressFromPathString
  }
}

export function makePrivateAccount(xpriv: string, config: IAccountConfig): Account {
  const xpub = xprivToXPub({
    xpriv,
    network: config.networkType,
    type: config.purpose,
    coin: config.coinName
  })

  return makeAccount(xpub, config)
}

export function makePrivateAccountFromMnemonic(mnemonic: string, config: IAccountConfig): Account {
  const coin = getCoinFromString(config.coinName).coinType
  const path = makePath({ purpose: config.purpose, coin })
  const xprv = mnemonicToXPriv({
    mnemonic,
    network: config.networkType,
    coin: config.coinName,
    type: config.purpose,
    path: path.toAccount()
  })
  return makePrivateAccount(xprv, config)
}
