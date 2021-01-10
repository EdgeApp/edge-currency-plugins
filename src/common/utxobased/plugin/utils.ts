import {
  addressToScriptPubkey,
  AddressTypeEnum,
  BIP43PurposeTypeEnum,
  ScriptTypeEnum,
  verifyAddress,
  VerifyAddressEnum
} from '../keymanager/keymanager'
import { getPurposeType } from '../../plugin/utils'
import { NetworkEnum } from '../../plugin/types'

export const getAddressType = (args: { keys: any }): AddressTypeEnum => {
  switch (getPurposeType(args)) {
    case BIP43PurposeTypeEnum.Legacy:
      return AddressTypeEnum.p2pkh

    case BIP43PurposeTypeEnum.WrappedSegwit:
      return AddressTypeEnum.p2sh

    case BIP43PurposeTypeEnum.Segwit:
      return AddressTypeEnum.p2wpkh
  }
}

export const getScriptType = (args: { keys: any }): ScriptTypeEnum => {
  switch (getPurposeType(args)) {
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
