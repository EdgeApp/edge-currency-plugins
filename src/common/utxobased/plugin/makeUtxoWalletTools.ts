import {
  addressToScriptPubkey,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  xprivToPrivateKey,
  xpubToPubkey
} from '../keymanager/keymanager'
import { getAddressType, getScriptType } from './utils'
import { getPurposeType, getXpriv, getXpub } from '../../plugin/utils'
import { NetworkEnum } from '../../plugin/types'

interface WalletToolsConfig {
  keys: any
  coin: string
  network: NetworkEnum
}

interface Args {
  changeIndex: 0 | 1
  addressIndex: number
}

export interface UTXOPluginWalletTools {
  getPubkey(args: Args): string

  getScriptPubKey(args: Args): string

  getRedeemScript(args: Args): string | undefined

  getAddress(args: Args): string

  addressToScriptPubkey(address: string): string

  getPrivateKey(args: Args): string
}

export function makeUtxoWalletTools(config: WalletToolsConfig): UTXOPluginWalletTools {
  const { coin, network } = config
  const type = getPurposeType(config)
  const xpub = getXpub(config)
  const xpriv = getXpriv(config)
  const scriptType = getScriptType(config)
  const addressType = getAddressType(config)

  const fns: UTXOPluginWalletTools = {
    getPubkey(args: Args): string {
      return xpubToPubkey({
        xpub,
        network,
        type,
        coin,
        bip44ChangeIndex: args.changeIndex,
        bip44AddressIndex: args.addressIndex
      })
    },

    getScriptPubKey(args: Args): string {
      return pubkeyToScriptPubkey({
        pubkey: fns.getPubkey(args),
        scriptType
      }).scriptPubkey
    },

    getRedeemScript(args: Args): string | undefined {
      return pubkeyToScriptPubkey({
        pubkey: fns.getPubkey(args),
        scriptType
      }).redeemScript
    },

    getAddress(args: Args): string {
      return scriptPubkeyToAddress({
        scriptPubkey: fns.getScriptPubKey(args),
        network,
        addressType,
        coin
      }).address
    },

    addressToScriptPubkey(address: string): string {
      return addressToScriptPubkey({ address, addressType, network, coin })
    },

    getPrivateKey(args: Args) {
      return xprivToPrivateKey({
        xpriv,
        network,
        type,
        coin,
        bip44ChangeIndex: args.changeIndex,
        bip44AddressIndex: args.addressIndex
      })
    }
  }

  return fns
}
