import { Disklet } from 'disklet'

import {
  addressToScriptPubkey,
  AddressTypeEnum,
  bip43PurposeNumberToTypeEnum,
  BIP43PurposeTypeEnum,
  ScriptTypeEnum,
  seedOrMnemonicToXPriv,
  verifyAddress,
  VerifyAddressEnum,
  wifToPrivateKey,
  xprivToXPub
} from '../keymanager/keymanager'
import { CurrencyFormat, NetworkEnum } from '../../plugin/types'
import * as pluginUtils from '../../plugin/utils'

export const getCurrencyFormatFromPurposeType = (purpose: BIP43PurposeTypeEnum): CurrencyFormat => {
  switch (purpose) {
    case BIP43PurposeTypeEnum.Legacy:
      return 'bip44'

    case BIP43PurposeTypeEnum.WrappedSegwit:
      return 'bip49'

    case BIP43PurposeTypeEnum.Segwit:
      return 'bip84'
  }
}

export const getAddressTypeFromKeys = (keys: any): AddressTypeEnum => {
  return getAddressTypeFromPurposeType(getPurposeTypeFromKeys({ keys }))
}

export const getAddressTypeFromPurposeType = (purpose: BIP43PurposeTypeEnum): AddressTypeEnum => {
  switch (purpose) {
    case BIP43PurposeTypeEnum.Legacy:
      return AddressTypeEnum.p2pkh

    case BIP43PurposeTypeEnum.WrappedSegwit:
      return AddressTypeEnum.p2sh

    case BIP43PurposeTypeEnum.Segwit:
      return AddressTypeEnum.p2wpkh
  }
}

export const getScriptTypeFromPurposeType = (purpose: BIP43PurposeTypeEnum): ScriptTypeEnum => {
  switch (purpose) {
    case BIP43PurposeTypeEnum.Legacy:
      return ScriptTypeEnum.p2pkh

    case BIP43PurposeTypeEnum.WrappedSegwit:
      return ScriptTypeEnum.p2wpkhp2sh

    case BIP43PurposeTypeEnum.Segwit:
      return ScriptTypeEnum.p2wpkh
  }
}

export const validScriptPubkeyFromAddress = (args: { address: string, coin: string, network: NetworkEnum }): string =>
  addressToScriptPubkey({
    ...args,
    legacy: verifyAddress(args) === VerifyAddressEnum.legacy
  })

export const getXprivKey = ({ coin }: { coin: string }): string =>
  `${coin}Xpriv`

export const getXpubKey = ({ coin }: { coin: string }): string =>
  `${coin}Xpub`

export const getXpriv = (args: { keys: any, coin: string }): CurrencyFormatKeys =>
  args.keys[getXprivKey(args)]

export const getXpub = (args: { keys: any, coin: string }): string =>
  args.keys[getXpubKey(args)]

export const getWalletCoinType = (args: { keys: any }): number =>
  args.keys.coinType ?? 0

export const getWalletFormat = (args: { keys: any }): CurrencyFormat =>
  args.keys.format ?? 'bip32'

export const getPurposeTypeFromKeys = (args: { keys: any }): BIP43PurposeTypeEnum => {
  return currencyFormatToPurposeType(getWalletFormat(args))
}

export const currencyFormatToPurposeType = (format: CurrencyFormat): BIP43PurposeTypeEnum =>
  bip43PurposeNumberToTypeEnum(
    parseInt(format.replace('bip', ''))
  )

type CurrencyFormatKeys = {
  [format in CurrencyFormat]?: string
}

export const fetchOrDeriveXprivFromKeys = async (args: { keys: any, walletLocalEncryptedDisklet: Disklet, coin: string, network: NetworkEnum, }): Promise<CurrencyFormatKeys> => {
  const filename = 'privateKeys.json'
  let keys: CurrencyFormatKeys
  try {
    const data = await args.walletLocalEncryptedDisklet.getText(filename)
    keys = JSON.parse(data)
  } catch (e) {
    keys = deriveXprivFromKeys(args)
    await args.walletLocalEncryptedDisklet.setText(filename, JSON.stringify(keys))
  }
  return keys
}

export const deriveXprivFromKeys = (args: { keys: any, coin: string, network: NetworkEnum }): CurrencyFormatKeys => {
  const keys: CurrencyFormatKeys = {}
  const xprivArgs = {
    seed: pluginUtils.getMnemonic(args),
    coinType: getWalletCoinType(args),
    coin: args.coin,
    network: args.network
  }
  switch (getPurposeTypeFromKeys(args)) {
    case BIP43PurposeTypeEnum.Segwit:
      keys[getCurrencyFormatFromPurposeType(BIP43PurposeTypeEnum.Segwit)] = seedOrMnemonicToXPriv({
        ...xprivArgs,
        type: BIP43PurposeTypeEnum.Segwit
      })
      keys[getCurrencyFormatFromPurposeType(BIP43PurposeTypeEnum.WrappedSegwit)] = seedOrMnemonicToXPriv({
        ...xprivArgs,
        type: BIP43PurposeTypeEnum.WrappedSegwit
      })
      break
    case BIP43PurposeTypeEnum.WrappedSegwit:
      keys[getCurrencyFormatFromPurposeType(BIP43PurposeTypeEnum.WrappedSegwit)] = seedOrMnemonicToXPriv({
        ...xprivArgs,
        type: BIP43PurposeTypeEnum.WrappedSegwit
      })
      break
    case BIP43PurposeTypeEnum.Legacy:
    default:
      keys[getCurrencyFormatFromPurposeType(BIP43PurposeTypeEnum.Legacy)] = seedOrMnemonicToXPriv({
        ...xprivArgs,
        type: BIP43PurposeTypeEnum.Legacy
      })
  }

  return keys
}

export const deriveXpubFromKeys = (args: { keys: any, coin: string, network: NetworkEnum }): string =>
  deriveXpub({
    ...args,
    type: getPurposeTypeFromKeys(args)
  })

export const deriveXpub = (args: { keys: any, type: BIP43PurposeTypeEnum, coin: string, network: NetworkEnum }): string =>
  xprivToXPub({
    ...args,
    xpriv: deriveXprivFromKeys(args)[getCurrencyFormatFromPurposeType(args.type)]!
  })

interface ParsePathNameResponse {
  privateKeys?: string[]
  publicAddress?: string
}

export const parsePathname = (args: { pathname: string, coin: string, network: NetworkEnum }): ParsePathNameResponse => {
  const parsedAddress: ParsePathNameResponse = {}

  // Check if the pathname type is a wif
  try {
    wifToPrivateKey({
      wifKey: args.pathname,
      network: args.network,
      coin: args.coin
    })
    parsedAddress.privateKeys = [ args.pathname ]
  } catch (e) {
    // If the pathname is non of the above, then assume it's an address and check for validity
    const addressFormat = verifyAddress({
      address: args.pathname,
      network: args.network,
      coin: args.coin
    })

    if (addressFormat === VerifyAddressEnum.bad) {
      throw new Error('InvalidPublicAddressError')
    } else {
      parsedAddress.publicAddress = args.pathname
    }
  }

  return parsedAddress
}
