import {
  asArray,
  asBoolean,
  asEither,
  asNumber,
  asObject,
  asOptional,
  asString,
  asValue,
  Cleaner
} from 'cleaners'

import { SoftPick } from '../../../util/typeUtil'
import { AddressPath, asCurrencyFormat } from '../../plugin/types'
import { asScriptTypeEnum, ScriptTypeEnum } from '../keymanager/keymanager'

export interface AddressData {
  scriptPubkey: string
  redeemScript?: string
  lastQueriedBlockHeight: number
  path?: AddressPath
  lastQuery: number
  lastTouched: number
  used: boolean
  balance?: string
}

export const asAddressData = asObject<AddressData>({
  scriptPubkey: asString,
  redeemScript: asOptional(asString),
  lastQueriedBlockHeight: asNumber,
  path: asOptional(
    // Built on use: `plugin/types.ts` imports this module, so
    // `asCurrencyFormat` is not defined yet when this one loads.
    (raw: unknown): AddressPath =>
      asObject({
        format: asCurrencyFormat,
        changeIndex: asNumber,
        addressIndex: asNumber
      })(raw)
  ),
  lastQuery: asNumber,
  lastTouched: asNumber,
  used: asBoolean,
  balance: asOptional(asString)
})

export const makeAddressData = (
  addressFields: SoftPick<AddressData, 'scriptPubkey'>
): AddressData => {
  const { scriptPubkey, used = false, ...rest } = addressFields

  return {
    scriptPubkey,
    used,
    lastQueriedBlockHeight: 0,
    lastQuery: 0,
    lastTouched: 0,
    ...rest
  }
}

export interface UtxoData {
  id: string
  txid: string
  vout: number
  value: string
  scriptPubkey: string
  script: string
  redeemScript?: string
  scriptType: ScriptTypeEnum
  blockHeight: number
  spent: boolean
}
export const asUtxoData = asObject<UtxoData>({
  id: asString,
  txid: asString,
  vout: asNumber,
  value: asString,
  scriptPubkey: asString,
  script: asString,
  redeemScript: asOptional(asString),
  scriptType: asScriptTypeEnum,
  blockHeight: asNumber,
  spent: asBoolean
})

export interface TransactionData {
  txid: string
  hex: string
  blockHeight: number
  confirmations?: 'confirmed' | 'unconfirmed' | 'dropped' | number
  date: number
  fees: string
  inputs: TransactionDataInput[]
  outputs: TransactionDataOutput[]
  ourIns: string[]
  ourOuts: string[]
  ourAmount: string
}

export interface TransactionDataOutput {
  amount: string
  n: number
  scriptPubkey: string
}

export interface TransactionDataInput {
  amount: string
  n: number
  outputIndex: number
  scriptPubkey: string
  sequence: number
  txId: string
}

export const asTransactionDataOutput = asObject<TransactionDataOutput>({
  amount: asString,
  n: asNumber,
  scriptPubkey: asString
})

/**
 * Lenient where older records are: inputs saved before the engine recorded
 * `sequence` have none, and are kept as they were stored.
 */
export const asTransactionDataInput = asObject({
  amount: asString,
  n: asNumber,
  outputIndex: asNumber,
  scriptPubkey: asString,
  sequence: asOptional(asNumber),
  txId: asString
}) as Cleaner<TransactionDataInput>

export const asTransactionData = asObject<TransactionData>({
  txid: asString,
  hex: asString,
  blockHeight: asNumber,
  confirmations: asOptional(
    asEither(asValue('confirmed', 'unconfirmed', 'dropped'), asNumber)
  ),
  date: asNumber,
  fees: asString,
  inputs: asArray(asTransactionDataInput),
  outputs: asArray(asTransactionDataOutput),
  ourIns: asArray(asString),
  ourOuts: asArray(asString),
  ourAmount: asString
})
