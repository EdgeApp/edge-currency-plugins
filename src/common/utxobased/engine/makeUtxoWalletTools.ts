import { AddressPath, CurrencyFormat } from '../../plugin/types'
import { ScriptTemplate } from '../info/scriptTemplates/types'
import { PublicKey } from '../keymanager/cleaners'
import {
  addressToScriptPubkey,
  privateKeyToPubkey,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  scriptPubkeyToP2SH,
  signMessageBase64,
  wifToPrivateKey,
  xprivToPrivateKey,
  xpubToPubkey
} from '../keymanager/keymanager'
import {
  CurrencyFormatKeys,
  currencyFormatToPurposeType,
  getAddressTypeFromPurposeType,
  getScriptTypeFromPurposeType
} from './utils'

export interface WalletToolsConfig {
  publicKey: PublicKey
  wifKeys?: string[]
  coin: string
}

export interface UTXOPluginWalletTools {
  getPubkey: (args: AddressPath) => string

  getScriptPubkey: (args: AddressPath) => ScriptPubkeyReturn

  getAddress: (args: AddressPath) => AddressReturn

  addressToScriptPubkey: (address: string) => string

  scriptPubkeyToAddress: (args: ScriptPubkeyToAddressArgs) => AddressReturn

  getPrivateKey: (args: GetPrivateKeyArgs) => string

  getScriptAddress: (args: GetScriptAddressArgs) => GetScriptAddressReturn

  signMessageBase64: (args: SignMessageArgs) => string
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

interface GetScriptAddressArgs {
  path: AddressPath
  scriptTemplate: ScriptTemplate
}

interface AddressReturn {
  address: string
  legacyAddress: string
}

interface GetScriptAddressReturn {
  address: string
  scriptPubkey: string
  redeemScript: string
}

interface SignMessageArgs {
  path: AddressPath
  message: string
  xprivKeys: CurrencyFormatKeys
}

export function makeUtxoWalletTools(
  config: WalletToolsConfig
): UTXOPluginWalletTools {
  const { coin, publicKey, wifKeys = [] } = config

  const xpubKeys = publicKey.publicKeys

  const getPrivateKeyFromWifAtIndex = (args: AddressPath): string => {
    if (args.changeIndex === 0 && wifKeys[args.addressIndex] != null) {
      return wifToPrivateKey({
        wifKey: wifKeys[args.addressIndex],
        coin
      })
    } else {
      throw new Error('no wif key at index')
    }
  }

  const fns: UTXOPluginWalletTools = {
    getPubkey(args: AddressPath): string {
      if (wifKeys.length > 0) {
        return privateKeyToPubkey(getPrivateKeyFromWifAtIndex(args))
      }
      if (xpubKeys[args.format] == null) {
        throw new Error(
          `wallet tools: xpub with format ${args.format} does not exist`
        )
      }
      return xpubToPubkey({
        xpub: xpubKeys[args.format] ?? '',
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
        addressType,
        coin
      })
    },

    addressToScriptPubkey(address: string): string {
      return addressToScriptPubkey({ address, coin })
    },

    scriptPubkeyToAddress(args: ScriptPubkeyToAddressArgs): AddressReturn {
      const purposeType = currencyFormatToPurposeType(args.format)
      const addressType = getAddressTypeFromPurposeType(purposeType)
      return scriptPubkeyToAddress({
        scriptPubkey: args.scriptPubkey,
        addressType,
        coin
      })
    },

    getPrivateKey(args: GetPrivateKeyArgs): string {
      const { path, xprivKeys } = args
      const xpriv = xprivKeys[path.format]
      if (wifKeys.length > 0) {
        return getPrivateKeyFromWifAtIndex(path)
      }
      if (xpriv == null) {
        throw new Error(
          `wallet tools: xpriv with format ${path.format} does not exist`
        )
      }
      return xprivToPrivateKey({
        xpriv: xpriv,
        type: currencyFormatToPurposeType(path.format),
        coin,
        bip44ChangeIndex: path.changeIndex,
        bip44AddressIndex: path.addressIndex
      })
    },

    getScriptAddress({
      path,
      scriptTemplate
    }: GetScriptAddressArgs): GetScriptAddressReturn {
      // get the replay protection script from the templates and wrap it in p2sh
      const publicKey = fns.getPubkey(path)
      const script = scriptTemplate(publicKey)
      const { address, scriptPubkey, redeemScript } = scriptPubkeyToP2SH({
        coin,
        scriptPubkey: script
      })
      if (address == null) {
        throw new Error('Failed to derive address for script')
      }
      return { address, scriptPubkey, redeemScript }
    },

    signMessageBase64({ path, message, xprivKeys }: SignMessageArgs): string {
      const privKey = fns.getPrivateKey({
        path,
        xprivKeys
      })
      return signMessageBase64(message, privKey)
    }
  }

  return fns
}
