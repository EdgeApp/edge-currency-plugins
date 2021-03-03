import {
  addressToScriptPubkey,
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

export interface UtxoKeyFormat {
  [mnemonicKey: string]: any // ${coinName}Key = mnemonic or seed string
  format?: CurrencyFormat
  coinType?: number
}

export interface WalletToolsConfig {
  keys: UtxoKeyFormat
  coin: string
  network: NetworkEnum
}

export interface BitcoinWalletToolsConfig extends WalletToolsConfig {
  keys: UtxoKeyFormat & { bitcoinKey: string }
  coin: 'bitcoin'
}

export interface UTXOPluginWalletTools {
  getPubkey(args: AddressPath): string

  getScriptPubkey(args: AddressPath): ScriptPubkeyReturn

  getAddress(args: AddressPath): AddressReturn

  addressToScriptPubkey(address: string): string

  scriptPubkeyToAddress(args: ScriptPubkeyToAddressArgs): AddressReturn

  getPrivateKey(args: AddressPath): string
}

interface ScriptPubkeyReturn {
  scriptPubkey: string
  redeemScript?: string
}

interface ScriptPubkeyToAddressArgs {
  scriptPubkey: string
  format: CurrencyFormat
}

interface AddressReturn {
  address: string
  legacyAddress: string
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

    getScriptPubkey(args: AddressPath): ScriptPubkeyReturn {
      const purposeType = currencyFormatToPurposeType(args.format)
      const scriptType = getScriptTypeFromPurposeType(purposeType)
      return pubkeyToScriptPubkey({
        pubkey: fns.getPubkey(args),
        scriptType
      })
    },

    getAddress(args: AddressPath): AddressReturn {
      const purposeType = currencyFormatToPurposeType(args.format)
      const { scriptPubkey } = fns.getScriptPubkey(args)
      const addressType = getAddressTypeFromPurposeType(purposeType)
      return scriptPubkeyToAddress({
        scriptPubkey,
        network,
        addressType,
        coin
      })
    },

    addressToScriptPubkey(address: string): string {
      return addressToScriptPubkey({ address, network, coin })
    },

    scriptPubkeyToAddress(args: ScriptPubkeyToAddressArgs): AddressReturn {
      const purposeType = currencyFormatToPurposeType(args.format)
      const addressType = getAddressTypeFromPurposeType(purposeType)
      return scriptPubkeyToAddress({
        scriptPubkey: args.scriptPubkey,
        network,
        addressType,
        coin
      })
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
