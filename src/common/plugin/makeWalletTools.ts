import {
  AddressTypeEnum,
  bip43PurposeNumberToTypeEnum,
  BIP43PurposeTypeEnum,
  NetworkEnum,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  ScriptTypeEnum, seedOrMnemonicToXPriv,
  xprivToPrivateKey,
  xpubToPubkey
} from '../utxobased/keymanager/keymanager'
import { EdgeWalletInfo } from 'edge-core-js'
import { EngineCurrencyInfo } from './types'
import { Disklet } from 'disklet'

interface WalletToolsConfig {
  currencyInfo: EngineCurrencyInfo
  walletInfo: EdgeWalletInfo
  encryptedDisklet: Disklet
  network: NetworkEnum
}

interface Args {
  changeIndex: 0 | 1
  addressIndex: number
}

export const getPurposeType = (walletInfo: EdgeWalletInfo): BIP43PurposeTypeEnum => {
  const formatNum = (walletInfo.keys.format as string).replace('bip', '')
  return bip43PurposeNumberToTypeEnum(Number(formatNum))
}

export const getMnemonicKey = (currencyInfo: EngineCurrencyInfo): string =>
  `${currencyInfo.network}Key`

export const getXprivKey = (currencyInfo: EngineCurrencyInfo): string =>
  `${currencyInfo.network}Xpriv`

export const getXpubKey = (currencyInfo: EngineCurrencyInfo): string =>
  `${currencyInfo.network}Xpub`

export interface PluginWalletTools {
  getNetworkType(): NetworkEnum

  getPurposeType(): BIP43PurposeTypeEnum

  getAddressType(): AddressTypeEnum

  getScriptType(): ScriptTypeEnum

  getPubkey(args: Args): string

  getScriptPubKey(args: Args): string

  getRedeemScript(args: Args): string | undefined

  getAddress(args: Args): string

  getPrivateKey(args: Args): string

  getXPub(): string

  getXPriv(): string

  getMnemonic(): string
}

export async function makeWalletTools(config: WalletToolsConfig): Promise<PluginWalletTools> {
  const {
    currencyInfo,
    walletInfo,
    encryptedDisklet,
    network
  } = config

  const mnemonicKey = getMnemonicKey(currencyInfo)
  const xprivKey = getXprivKey(currencyInfo)
  const xpubKey = getXpubKey(currencyInfo)
  const type = getPurposeType(walletInfo)

  const mnemonic = walletInfo.keys[mnemonicKey]
  const xpub = walletInfo.keys[xpubKey]

  let scriptType: ScriptTypeEnum
  let addressType: AddressTypeEnum
  switch (type) {
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

  const fns: PluginWalletTools = {
    getNetworkType(): NetworkEnum {
      return network
    },

    getPurposeType(): BIP43PurposeTypeEnum {
      return getPurposeType(walletInfo)
    },

    getAddressType(): AddressTypeEnum {
      return addressType
    },

    getScriptType(): ScriptTypeEnum {
      return scriptType
    },

    getPubkey: (args: Args): string => {
      return xpubToPubkey({
        xpub,
        network,
        type,
        coin: currencyInfo.network,
        bip44ChangeIndex: args.changeIndex,
        bip44AddressIndex: args.addressIndex
      })
    },

    getScriptPubKey: (args: Args): string => {
      return pubkeyToScriptPubkey({
        pubkey: fns.getPubkey(args),
        scriptType
      }).scriptPubkey
    },

    getRedeemScript: (args: Args): string | undefined => {
      return pubkeyToScriptPubkey({
        pubkey: fns.getPubkey(args),
        scriptType
      }).redeemScript
    },

    getAddress: (args: Args): string => {
      return scriptPubkeyToAddress({
        scriptPubkey: fns.getScriptPubKey(args),
        network,
        addressType,
        coin: currencyInfo.network
      }).address
    },

    getPrivateKey(args: Args) {
      return xprivToPrivateKey({
        xpriv: fns.getXPriv(),
        network,
        type,
        coin: currencyInfo.network,
        bip44ChangeIndex: args.changeIndex,
        bip44AddressIndex: args.addressIndex
      })
    },

    getXPub(): string {
      return xpub
    },

    getXPriv(): string {
      return seedOrMnemonicToXPriv({
        seed: mnemonic,
        coinType: walletInfo.keys.coinType,
        network,
        type,
        coin: currencyInfo.network
      })
    },

    getMnemonic(): string {
      return mnemonic
    }
  }

  return fns
}
