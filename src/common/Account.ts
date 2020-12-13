import {
  AddressTypeEnum,
  airbitzSeedToXPriv,
  airbitzXPrivToPrivateKey,
  BIP43PurposeTypeEnum,
  mnemonicToXPriv,
  NetworkEnum,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  ScriptTypeEnum,
  xprivToPrivateKey,
  xprivToXPub,
  xpubToPubkey
} from './utxobased/keymanager/keymanager'
import { makePath, makePathFromString, Path } from './Path'
import { getCoinFromString } from './utxobased/keymanager/coinmapper'
import { Coin } from './utxobased/keymanager/coin'

export interface IAccountConfig {
  purpose: BIP43PurposeTypeEnum
  coinName: string
  networkType: NetworkEnum
}

export interface Account {
  xpub: string
  path: Path
  coin: Coin
  coinName: string
  purpose: BIP43PurposeTypeEnum
  networkType: NetworkEnum
  addressType: AddressTypeEnum
  scriptType: ScriptTypeEnum

  getPubKey(p?: Path): string

  getScriptPubKey(p?: Path): string

  getRedeemScript(p?: Path): string | undefined

  getAddress(p?: Path): string

  getAddressFromPathString(path: string): string

  isPrivate(): this is PrivateAccount
}

export interface PrivateAccount extends Account {
  getPrivateKey(p?: Path): string
}

export function makeAccount(xpub: string, config: IAccountConfig): Account {
  config = { ...config }
  const coin = getCoinFromString(config.coinName)
  const path = makePath({ purpose: config.purpose, coin: coin.coinType })
  const addressType = path.addressType
  const scriptType = path.scriptType
  const account: Account = {
    xpub,
    path,
    coin,
    get coinName(): string {
      return config.coinName
    },
    get purpose(): BIP43PurposeTypeEnum {
      return config.purpose
    },
    get networkType(): NetworkEnum {
      return config.networkType
    },
    get addressType(): AddressTypeEnum {
      return addressType
    },
    get scriptType(): ScriptTypeEnum {
      return scriptType
    },

    getPubKey(p = account.path): string {
      const bip44ChangeIndex = config.purpose === BIP43PurposeTypeEnum.Airbitz
        ? undefined
        : p.change
      return xpubToPubkey({
        xpub: xpub,
        network: account.networkType,
        type: account.purpose,
        coin: account.coinName,
        bip44ChangeIndex,
        bip44AddressIndex: p.index
      })
    },

    getScriptPubKey(p = account.path): string {
      return pubkeyToScriptPubkey({
        pubkey: account.getPubKey(p),
        scriptType: p.scriptType
      }).scriptPubkey
    },

    getRedeemScript(p = account.path): string | undefined {
      return pubkeyToScriptPubkey({
        pubkey: account.getPubKey(p),
        scriptType: p.scriptType
      }).redeemScript
    },

    getAddress(p = account.path): string {
      return scriptPubkeyToAddress({
        scriptPubkey: account.getScriptPubKey(p),
        network: account.networkType,
        addressType: p.addressType,
        coin: account.coinName
      })
    },

    getAddressFromPathString(path: string): string {
      return account.getAddress(makePathFromString(path))
    },

    isPrivate(): boolean {
      return false
    }
  }

  return account
}

export function makePrivateAccount(xpriv: string, config: IAccountConfig): PrivateAccount {
  const xpub = xprivToXPub({
    xpriv,
    network: config.networkType,
    type: config.purpose,
    coin: config.coinName
  })

  const getAirbitzPrivateKey = (p: Path): string =>
    airbitzXPrivToPrivateKey(xpriv, p.index)
  const getBip43PrivateKey = (p: Path): string =>
    xprivToPrivateKey({
      xpriv,
      network: account.networkType,
      type: account.purpose,
      coin: account.coinName,
      bip44ChangeIndex: p.change,
      bip44AddressIndex: p.index
    })

  const account = makeAccount(xpub, config)
  return {
    ...account,

    isPrivate(): boolean {
      return true
    },

    getPrivateKey(p = account.path): string {
      return p.purpose === BIP43PurposeTypeEnum.Airbitz
        ? getAirbitzPrivateKey(p)
        : getBip43PrivateKey(p)
    }
  }
}

export function makePrivateAccountFromMnemonic(mnemonic: string, config: IAccountConfig): PrivateAccount {
  const coin = getCoinFromString(config.coinName).coinType
  const path = makePath({ purpose: config.purpose, coin })
  const xprv = config.purpose === BIP43PurposeTypeEnum.Airbitz
    ? airbitzSeedToXPriv(mnemonic)
    : mnemonicToXPriv({
      mnemonic,
      network: config.networkType,
      coin: config.coinName,
      type: config.purpose,
      path: path.toAccount()
    })
  return makePrivateAccount(xprv, config)
}
