import {
  addressToScriptPubkey,
  AddressTypeEnum,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  xprivToPrivateKey,
  xprivToXPub,
  xpubToPubkey
} from '../keymanager/keymanager'
import {
  currencyFormatToPurposeType,
  getAddressTypeFromPurposeType,
  getScriptTypeFromPurposeType,
  getXpriv
} from './utils'
import { AddressPath, CurrencyFormat, NetworkEnum } from '../../plugin/types'

interface WalletToolsConfig {
  keys: any
  coin: string
  network: NetworkEnum
}

export interface UTXOPluginWalletTools {
  getPubkey(args: AddressPath): string

  getScriptPubKey(args: AddressPath): { scriptPubkey: string, redeemScript?: string }

  getAddress(args: AddressPath): { address: string, legacyAddress: string }

  addressToScriptPubkey(address: string): string

  getPrivateKey(args: AddressPath): string
}

export function makeUtxoWalletTools(config: WalletToolsConfig): UTXOPluginWalletTools {
  const { coin, network } = config

  const xprivKeys = getXpriv(config)
  // Convert xprivs to xpubs
  const xpubKeys = Object.assign({}, xprivKeys)
  for (const key in xpubKeys) {
    const format = <CurrencyFormat>key
    xpubKeys[format] = xprivToXPub({
      xpriv: xpubKeys[format]!,
      type: currencyFormatToPurposeType(format),
      coin,
      network
    })
  }

  const fns: UTXOPluginWalletTools = {
    getPubkey(args: AddressPath): string {
      return xpubToPubkey({
        xpub: xpubKeys[args.format]!,
        network,
        coin,
        type: currencyFormatToPurposeType(args.format),
        bip44ChangeIndex: args.changeIndex,
        bip44AddressIndex: args.addressIndex
      })
    },

    getScriptPubKey(args: AddressPath): { scriptPubkey: string, redeemScript?: string } {
      return pubkeyToScriptPubkey({
        pubkey: fns.getPubkey(args),
        scriptType: getScriptTypeFromPurposeType(currencyFormatToPurposeType(args.format))
      })
    },

    getAddress(args: AddressPath): { address: string, legacyAddress: string } {
      const purposeType = currencyFormatToPurposeType(args.format)
      return scriptPubkeyToAddress({
        scriptPubkey: fns.getScriptPubKey(args).scriptPubkey,
        network,
        addressType: getAddressTypeFromPurposeType(purposeType),
        coin
      })
    },

    addressToScriptPubkey(address: string): string {
      return addressToScriptPubkey({ address, network, coin })
    },

    getPrivateKey(args: AddressPath) {
      return xprivToPrivateKey({
        xpriv: xprivKeys[args.format]!,
        network,
        type: currencyFormatToPurposeType(args.format),
        coin,
        bip44ChangeIndex: args.changeIndex,
        bip44AddressIndex: args.addressIndex
      })
    }
  }

  return fns
}
