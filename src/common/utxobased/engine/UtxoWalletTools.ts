import {
  AddressPath,
  ChangePath,
  CurrencyFormat,
  PluginInfo
} from '../../plugin/types'
import { ScriptTemplate } from '../info/scriptTemplates/types'
import { PublicKey } from '../keymanager/cleaners'
import {
  addressToScriptPubkey,
  BIP43PurposeTypeEnum,
  PrivateKeyEncoding,
  privateKeyEncodingToPubkey,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  scriptPubkeyToP2SH,
  signMessageBase64,
  wifToPrivateKeyEncoding,
  xprivToPrivateKey,
  xpubToPubkey
} from '../keymanager/keymanager'
import {
  CurrencyFormatKeys,
  currencyFormatToPurposeType,
  getAddressTypeFromPurposeType,
  getScriptTypeFromPurposeType,
  pathToPurposeType
} from './utils'

export interface WalletToolsConfig {
  pluginInfo: PluginInfo
  publicKey: PublicKey
}

export interface UtxoWalletTools {
  getPubkey: (args: AddressPath) => string

  getScriptPubkey: (args: AddressPath) => ScriptPubkeyReturn

  getScriptPubkeyFromWif: (
    wif: string,
    format: CurrencyFormat
  ) => ScriptPubkeyReturn

  getAddress: (args: AddressPath) => AddressReturn

  addressToScriptPubkey: (address: string) => string

  scriptPubkeyToAddress: (args: ScriptPubkeyToAddressArgs) => AddressReturn

  getPrivateKey: (args: GetPrivateKeyArgs) => string

  getPrivateKeyEncodingFromWif: (wif: string) => PrivateKeyEncoding

  getScriptAddress: (args: GetScriptAddressArgs) => GetScriptAddressReturn

  signMessageBase64: (args: SignMessageArgs) => string
}

interface ScriptPubkeyReturn {
  scriptPubkey: string
  redeemScript?: string
}

interface ScriptPubkeyToAddressArgs {
  changePath: ChangePath
  scriptPubkey: string
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
): UtxoWalletTools {
  const { pluginInfo, publicKey } = config
  const { engineInfo } = pluginInfo
  const { name: coin } = pluginInfo.coinInfo

  const xpubKeys = publicKey.publicKeys

  const fns: UtxoWalletTools = {
    getPubkey(args: AddressPath): string {
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
      const purposeType = pathToPurposeType(args, engineInfo.scriptTemplates)
      const scriptType = getScriptTypeFromPurposeType(purposeType)
      return pubkeyToScriptPubkey({
        pubkey: fns.getPubkey(args),
        scriptTemplates: engineInfo.scriptTemplates,
        scriptType
      })
    },

    // Used specifically for sweeping private keys (WIFs)
    getScriptPubkeyFromWif(
      wifKey: string,
      format: CurrencyFormat
    ): ScriptPubkeyReturn {
      const purposeType = currencyFormatToPurposeType(format)
      const scriptType = getScriptTypeFromPurposeType(purposeType)
      const privateKeyEncoding = wifToPrivateKeyEncoding({
        wifKey,
        coin
      })

      // Restrict only compressed keys for segwit pubkeys as per BIP143
      // (see https://github.com/bitcoin/bips/blob/master/bip-0143.mediawiki#restrictions-on-public-key-type)
      if (
        [
          BIP43PurposeTypeEnum.Segwit,
          BIP43PurposeTypeEnum.WrappedSegwit
        ].includes(purposeType) &&
        !privateKeyEncoding.compressed
      ) {
        privateKeyEncoding.compressed = true
      }

      const pubkey = privateKeyEncodingToPubkey(privateKeyEncoding)
      return pubkeyToScriptPubkey({
        pubkey: pubkey,
        scriptTemplates: engineInfo.scriptTemplates,
        scriptType
      })
    },

    getAddress(args: AddressPath): AddressReturn {
      const purposeType = pathToPurposeType(
        args,
        pluginInfo.engineInfo.scriptTemplates
      )
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
      const { changePath } = args
      const purposeType = pathToPurposeType(
        changePath,
        pluginInfo.engineInfo.scriptTemplates
      )
      const addressType = getAddressTypeFromPurposeType(purposeType)

      return scriptPubkeyToAddress({
        scriptPubkey: args.scriptPubkey,
        addressType,
        coin,
        includeCashaddrPrefix: pluginInfo.coinInfo.includeCashaddrPrefix
      })
    },

    getPrivateKey(args: GetPrivateKeyArgs): string {
      const { path, xprivKeys } = args
      const xpriv = xprivKeys[path.format]
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

    getPrivateKeyEncodingFromWif(wifKey: string): PrivateKeyEncoding {
      return wifToPrivateKeyEncoding({
        wifKey,
        coin
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
