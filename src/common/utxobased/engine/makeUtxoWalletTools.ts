import { AddressPath, CurrencyFormat, NetworkEnum } from '../../plugin/types'
import {
  addressToScriptPubkey,
  privateKeyToPubkey,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  wifToPrivateKey,
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

export interface UtxoKeyFormat {
  [mnemonicKey: string]: any // ${coinName}Key = mnemonic or seed string
  format?: CurrencyFormat
  coinType?: number
  wifKeys?: string[]
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
  getPubkey: (args: AddressPath) => string

  getScriptPubkey: (args: AddressPath) => ScriptPubkeyReturn

  getAddress: (args: AddressPath) => AddressReturn

  addressToScriptPubkey: (address: string) => string

  scriptPubkeyToAddress: (args: ScriptPubkeyToAddressArgs) => AddressReturn

  getPrivateKey: (args: AddressPath) => string
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

export function makeUtxoWalletTools(
  config: WalletToolsConfig
): UTXOPluginWalletTools {
  const { coin, network } = config

  const xprivKeys = getXpriv(config)
  // Convert xprivs to xpubs
  const xpubKeys = Object.assign({}, xprivKeys)
  for (const key in xpubKeys) {
    const format = key as CurrencyFormat
    xpubKeys[format] = xprivToXPub({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      xpriv: xpubKeys[format]!,
      type: currencyFormatToPurposeType(format),
      coin,
      network
    })
  }

  let wifKeys: string[]
  if (config.keys.wifKeys != null) {
    wifKeys = config.keys.wifKeys
  }

  const getPrivateKeyAtIndex = (args: AddressPath): string => {
    if (args.changeIndex === 0 && wifKeys[args.addressIndex] != null) {
      return wifToPrivateKey({
        wifKey: wifKeys[args.addressIndex],
        network,
        coin
      })
    } else {
      throw new Error('no wif key at index')
    }
  }

  const fns: UTXOPluginWalletTools = {
    getPubkey(args: AddressPath): string {
      if (wifKeys != null) {
        return privateKeyToPubkey(getPrivateKeyAtIndex(args))
      }
      return xpubToPubkey({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
      // returning for any change index will result in duplicates
      if (wifKeys != null) {
        return getPrivateKeyAtIndex(args)
      }
      return xprivToPrivateKey({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
