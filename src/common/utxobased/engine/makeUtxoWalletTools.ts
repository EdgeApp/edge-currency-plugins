import {
  AddressPath,
  CoinInfo,
  CurrencyFormat,
  NetworkEnum
} from '../../plugin/types'
import {
  addressToScriptPubkey,
  privateKeyToPubkey,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  wifToPrivateKey,
  xprivToPrivateKey,
  xpubToPubkey
} from '../keymanager/keymanager'
import {
  CurrencyFormatKeys,
  currencyFormatToPurposeType,
  getAddressTypeFromPurposeType,
  getScriptTypeFromPurposeType,
  getXpubs
} from './utils'

export interface UtxoKeyFormat {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [mnemonicKey: string]: any // ${coinName}Key = mnemonic or seed string
  format?: CurrencyFormat
  coinType?: number
  wifKeys?: string[]
}

export interface WalletToolsConfig {
  keys: UtxoKeyFormat
  coinInfo: CoinInfo
  network: NetworkEnum
}

export interface UTXOPluginWalletTools {
  getPubkey: (args: AddressPath) => string

  getScriptPubkey: (args: AddressPath) => ScriptPubkeyReturn

  getAddress: (args: AddressPath) => AddressReturn

  addressToScriptPubkey: (address: string) => string

  scriptPubkeyToAddress: (args: ScriptPubkeyToAddressArgs) => AddressReturn

  getPrivateKey: (args: GetPrivateKeyArgs) => string
}

interface ScriptPubkeyReturn {
  scriptPubkey: string
  redeemScript?: string
}

interface ScriptPubkeyToAddressArgs {
  scriptPubkey: string
  format: CurrencyFormat
}

interface GetPrivateKeyArgs {
  path: AddressPath
  xprivKeys: CurrencyFormatKeys
}

interface AddressReturn {
  address: string
  legacyAddress: string
}

export function makeUtxoWalletTools(
  config: WalletToolsConfig
): UTXOPluginWalletTools {
  const { coinInfo, keys, network } = config

  const xpubKeys = getXpubs(keys, coinInfo.name)

  let wifKeys: string[]
  if (config.keys.wifKeys != null) {
    wifKeys = config.keys.wifKeys
  }

  const getPrivateKeyAtIndex = (args: AddressPath): string => {
    if (args.changeIndex === 0 && wifKeys[args.addressIndex] != null) {
      return wifToPrivateKey({
        wifKey: wifKeys[args.addressIndex],
        network,
        coinInfo
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
      if (xpubKeys[args.format] == null) {
        throw new Error(
          `wallet tools: xpub with format ${args.format} does not exist`
        )
      }
      return xpubToPubkey({
        xpub: xpubKeys[args.format] ?? '',
        network,
        coinInfo,
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
        coinInfo
      })
    },

    addressToScriptPubkey(address: string): string {
      return addressToScriptPubkey({ address, network, coinInfo })
    },

    scriptPubkeyToAddress(args: ScriptPubkeyToAddressArgs): AddressReturn {
      const purposeType = currencyFormatToPurposeType(args.format)
      const addressType = getAddressTypeFromPurposeType(purposeType)
      return scriptPubkeyToAddress({
        scriptPubkey: args.scriptPubkey,
        network,
        addressType,
        coinInfo
      })
    },

    getPrivateKey(args: GetPrivateKeyArgs): string {
      const { path, xprivKeys } = args
      if (wifKeys != null) {
        return getPrivateKeyAtIndex(path)
      }
      if (xprivKeys[path.format] != null) {
        throw new Error(
          `wallet tools: xpriv with format ${path.format} does not exist`
        )
      }
      return xprivToPrivateKey({
        xpriv: xprivKeys[path.format] ?? '',
        network,
        type: currencyFormatToPurposeType(path.format),
        coinInfo,
        bip44ChangeIndex: path.changeIndex,
        bip44AddressIndex: path.addressIndex
      })
    }
  }

  return fns
}
