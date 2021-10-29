import * as bs from 'biggystring'
import { Disklet } from 'disklet'
import { EdgeParsedUri } from 'edge-core-js/types'

import { CurrencyFormat } from '../../plugin/types'
import { IUTXO } from '../db/types'
import { getSupportedFormats, PrivateKey } from '../keymanager/cleaners'
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

export const getCurrencyFormatFromPurposeType = (
  purpose: BIP43PurposeTypeEnum
): CurrencyFormat => {
  switch (purpose) {
    case BIP43PurposeTypeEnum.Airbitz:
      return 'bip32'
    case BIP43PurposeTypeEnum.Legacy:
      return 'bip44'
    case BIP43PurposeTypeEnum.WrappedSegwit:
      return 'bip49'
    case BIP43PurposeTypeEnum.Segwit:
      return 'bip84'
  }
}

export const getAddressTypeFromKeys = (
  privateKey: PrivateKey
): AddressTypeEnum => {
  return getAddressTypeFromPurposeType(
    currencyFormatToPurposeType(privateKey.format)
  )
}

export const getAddressTypeFromPurposeType = (
  purpose: BIP43PurposeTypeEnum
): AddressTypeEnum => {
  switch (purpose) {
    case BIP43PurposeTypeEnum.Airbitz:
    case BIP43PurposeTypeEnum.Legacy:
      return AddressTypeEnum.p2pkh

    case BIP43PurposeTypeEnum.WrappedSegwit:
      return AddressTypeEnum.p2sh

    case BIP43PurposeTypeEnum.Segwit:
      return AddressTypeEnum.p2wpkh
  }
}

export const getScriptTypeFromPurposeType = (
  purpose: BIP43PurposeTypeEnum
): ScriptTypeEnum => {
  switch (purpose) {
    case BIP43PurposeTypeEnum.Airbitz:
    case BIP43PurposeTypeEnum.Legacy:
      return ScriptTypeEnum.p2pkh

    case BIP43PurposeTypeEnum.WrappedSegwit:
      return ScriptTypeEnum.p2wpkhp2sh

    case BIP43PurposeTypeEnum.Segwit:
      return ScriptTypeEnum.p2wpkh
  }
}

export const validScriptPubkeyFromAddress = (args: {
  address: string
  coin: string
}): string =>
  addressToScriptPubkey({
    ...args
  })

export const getFormatSupportedBranches = (
  format: CurrencyFormat
): number[] => {
  const branches = [0]
  if (currencyFormatToPurposeType(format) !== BIP43PurposeTypeEnum.Airbitz) {
    branches.push(1)
  }
  return branches
}

export const currencyFormatToPurposeType = (
  format: CurrencyFormat
): BIP43PurposeTypeEnum =>
  bip43PurposeNumberToTypeEnum(parseInt(format.replace('bip', '')))

export type CurrencyFormatKeys = {
  [format in CurrencyFormat]?: string
}

export const fetchOrDeriveXprivFromKeys = async (args: {
  privateKey: PrivateKey
  walletLocalEncryptedDisklet: Disklet
  coin: string
}): Promise<CurrencyFormatKeys> => {
  const filename = 'walletKeys.json'
  let keys: CurrencyFormatKeys
  try {
    const data = await args.walletLocalEncryptedDisklet.getText(filename)
    keys = JSON.parse(data)
  } catch (e) {
    keys = deriveXprivFromKeys(args)
    await args.walletLocalEncryptedDisklet.setText(
      filename,
      JSON.stringify(keys)
    )
  }
  return keys
}

export const deriveXprivFromKeys = (args: {
  privateKey: PrivateKey
  coin: string
}): CurrencyFormatKeys => {
  const keys: CurrencyFormatKeys = {}
  const xprivArgs = {
    seed: args.privateKey.seed,
    coinType: args.privateKey.coinType,
    coin: args.coin
  }
  const walletPurpose = currencyFormatToPurposeType(args.privateKey.format)
  if (
    walletPurpose === BIP43PurposeTypeEnum.Segwit ||
    walletPurpose === BIP43PurposeTypeEnum.WrappedSegwit
  ) {
    keys[
      getCurrencyFormatFromPurposeType(BIP43PurposeTypeEnum.Segwit)
    ] = seedOrMnemonicToXPriv({
      ...xprivArgs,
      type: BIP43PurposeTypeEnum.Segwit
    })
    keys[
      getCurrencyFormatFromPurposeType(BIP43PurposeTypeEnum.WrappedSegwit)
    ] = seedOrMnemonicToXPriv({
      ...xprivArgs,
      type: BIP43PurposeTypeEnum.WrappedSegwit
    })
  } else {
    keys[
      getCurrencyFormatFromPurposeType(walletPurpose)
    ] = seedOrMnemonicToXPriv({
      ...xprivArgs,
      type: walletPurpose
    })
  }

  return keys
}

export const deriveXpubsFromKeys = (args: {
  privateKey: PrivateKey
  coin: string
}): CurrencyFormatKeys => {
  const xpubs: CurrencyFormatKeys = {}
  for (const format of getSupportedFormats(args.privateKey.format)) {
    xpubs[format] = deriveXpub({
      ...args,
      type: currencyFormatToPurposeType(format)
    })
  }
  return xpubs
}

export const deriveXpub = (args: {
  privateKey: PrivateKey
  coin: string
  type: BIP43PurposeTypeEnum
}): string => {
  const xpriv = deriveXprivFromKeys(args)[
    getCurrencyFormatFromPurposeType(args.type)
  ]
  if (xpriv == null)
    throw new Error('Cannot derive xpub: no private key exists')
  return xprivToXPub({ ...args, xpriv })
}

export const parsePathname = (args: {
  pathname: string
  coin: string
}): EdgeParsedUri => {
  const edgeParsedUri: EdgeParsedUri = {}

  // Check if the pathname type is a wif
  try {
    wifToPrivateKey({
      wifKey: args.pathname,
      coin: args.coin
    })
    edgeParsedUri.privateKeys = [args.pathname]
  } catch (e) {
    // If the pathname is non of the above, then assume it's an address and check for validity
    const addressFormat = verifyAddress({
      address: args.pathname,
      coin: args.coin
    })

    switch (addressFormat) {
      case VerifyAddressEnum.good:
        edgeParsedUri.publicAddress = args.pathname
        break
      case VerifyAddressEnum.legacy:
        edgeParsedUri.legacyAddress = args.pathname
        break
      case VerifyAddressEnum.bad:
        throw new Error('InvalidPublicAddressError')
    }
  }

  return edgeParsedUri
}

export const sumUtxos = (utxos: IUTXO[]): string =>
  utxos.reduce((sum, { value }) => bs.add(sum, value), '0')
