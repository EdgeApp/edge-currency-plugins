import * as bs from 'biggystring'
import { Disklet } from 'disklet'
import { EdgeParsedUri } from 'edge-core-js/types'

import { ChangePath, CurrencyFormat, EngineInfo } from '../../plugin/types'
import { IUTXO } from '../db/types'
import { ScriptTemplates } from '../info/scriptTemplates/types'
import { getSupportedFormats, PrivateKey } from '../keymanager/cleaners'
import {
  addressToScriptPubkey,
  AddressTypeEnum,
  bip43PurposeNumberToTypeEnum,
  BIP43PurposeTypeEnum,
  derivationLevelScriptHash,
  isPathUsingDerivationLevelScriptHash,
  ScriptTypeEnum,
  seedOrMnemonicToXPriv,
  toNewFormat,
  verifyAddress,
  VerifyAddressEnum,
  wifToPrivateKeyEncoding,
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
    case BIP43PurposeTypeEnum.ReplayProtection:
      return 'bip44' // Only bip44 formatted wallets contain this purpose type (BCH)
  }
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

    case BIP43PurposeTypeEnum.ReplayProtection:
      return AddressTypeEnum.p2sh
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

    case BIP43PurposeTypeEnum.ReplayProtection:
      return ScriptTypeEnum.replayProtection
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
  engineInfo: EngineInfo,
  format: CurrencyFormat
): number[] => {
  const branches = [0]
  if (currencyFormatToPurposeType(format) !== BIP43PurposeTypeEnum.Airbitz) {
    branches.push(1)
  }
  if (engineInfo.scriptTemplates != null) {
    if (engineInfo.scriptTemplates.replayProtection != null) {
      branches.push(
        derivationLevelScriptHash(engineInfo.scriptTemplates.replayProtection)
      )
    }
  }
  return branches
}

/**
 * The reason for this function is to consider the address path for
 * determining the purpose-type for the address. This is because some parts
 * of the address such as the changeIndex have special meaning for the
 * purpose-type. Specifically for scriptTemplates, the hash of the template
 * is used to deterministically identify the changeIndex used constantly for
 * the addresses spending to those scriptTemplates.
 *
 * In the future, we will want to strictly use only the format of the path
 * in order to determine the purpose-type per the BIP43 spec. This will require
 * a significant lift to reconsider the type for the path's format (currently
 * CurrencyFormat). The scriptTemplates could define a format index and this
 * could be used in address paths instead of a CurrencyType.
 */
export const pathToPurposeType = (
  path: ChangePath,
  scriptTemplates?: ScriptTemplates
): BIP43PurposeTypeEnum => {
  // Script Template Purpose Types
  if (scriptTemplates != null) {
    // TODO: Change ScriptTemplates map type to couple the key to the ScriptTypeEnum; make this algorithm generic and move it to key-manager
    // Handle each hard-coded case for the supported script templates
    if (
      scriptTemplates.replayProtection != null &&
      isPathUsingDerivationLevelScriptHash(
        scriptTemplates.replayProtection,
        path
      )
    ) {
      return BIP43PurposeTypeEnum.ReplayProtection
    }
  }
  return currencyFormatToPurposeType(path.format)
}

/**
 * Only use this function when needing to infer the purpose-type for a wallet
 * format (CurrencyFormat). To get the purpose-type for an address use
 * pathToPurposeType passing the address path.
 */
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
  engineInfo: EngineInfo
  privateKey: PrivateKey
  coin: string
}): CurrencyFormatKeys => {
  const { engineInfo, privateKey, coin } = args
  const xpubs: CurrencyFormatKeys = {}
  for (const format of getSupportedFormats(engineInfo, privateKey.format)) {
    const xpriv = deriveXprivFromKeys({
      coin,
      privateKey
    })[format]
    if (xpriv == null)
      throw new Error('Cannot derive xpub: no private key exists')
    xpubs[format] = xprivToXPub({
      coin,
      type: currencyFormatToPurposeType(format),
      xpriv
    })
  }
  return xpubs
}

export const parsePathname = (args: {
  pathname: string
  coin: string
}): EdgeParsedUri => {
  const edgeParsedUri: EdgeParsedUri = {}

  // Check if the pathname type is a wif
  try {
    wifToPrivateKeyEncoding({
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

    // Throw if address format failed
    if (addressFormat === VerifyAddressEnum.bad)
      throw new Error('InvalidPublicAddressError')

    // Format publicAddress to the latest format from the provided address
    edgeParsedUri.publicAddress = toNewFormat(args.pathname, args.coin)

    // Include a legacyAddress if the provided format is a legacy format
    if (addressFormat === VerifyAddressEnum.legacy)
      edgeParsedUri.legacyAddress = args.pathname
  }

  return edgeParsedUri
}

export const sumUtxos = (utxos: IUTXO[]): string =>
  utxos.reduce(
    (sum, { spent, value }) => (spent ? sum : bs.add(sum, value)),
    '0'
  )
