import { AddressPath, CurrencyFormat, NetworkEnum } from '../../plugin/types'
import { ScriptTemplate } from '../info/scriptTemplates/types'
import {
  addressToScriptPubkey,
  privateKeyToPubkey,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  scriptPubkeyToP2SH,
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
  coin: string
  network: NetworkEnum
}

export interface BitcoinWalletToolsConfig extends WalletToolsConfig {
  keys: UtxoKeyFormat & { bitcoinKey: string }
  coin: string // for example bitcoin
}

export interface UTXOPluginWalletTools {
  getPubkey: (args: AddressPath) => string

  getScriptPubkey: (args: AddressPath) => ScriptPubkeyReturn

  getAddress: (args: AddressPath) => AddressReturn

  addressToScriptPubkey: (address: string) => string

  scriptPubkeyToAddress: (args: ScriptPubkeyToAddressArgs) => AddressReturn

  getPrivateKey: (args: GetPrivateKeyArgs) => string

  getScriptAddress: (args: GetScriptAddressArgs) => GetScriptAddressReturn
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

export function makeUtxoWalletTools(
  config: WalletToolsConfig
): UTXOPluginWalletTools {
  const { coin, network } = config

  const xpubKeys = getXpubs(config)

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
      if (xpubKeys[args.format] == null) {
        throw new Error(
          `wallet tools: xpub with format ${args.format} does not exist`
        )
      }
      return xpubToPubkey({
        xpub: xpubKeys[args.format] ?? '',
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

    getPrivateKey(args: GetPrivateKeyArgs): string {
      const { path, xprivKeys } = args
      const xpriv = xprivKeys[path.format]
      if (wifKeys != null) {
        return getPrivateKeyAtIndex(path)
      }
      if (xpriv == null) {
        throw new Error(
          `wallet tools: xpriv with format ${path.format} does not exist`
        )
      }
      return xprivToPrivateKey({
        xpriv: xpriv,
        network,
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
        network,
        scriptPubkey: script
      })
      if (address == null) {
        throw new Error('Failed to derive address for script')
      }
      return { address, scriptPubkey, redeemScript }
    }
  }

  return fns
}
