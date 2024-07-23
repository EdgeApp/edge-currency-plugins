import { asBoolean, asNumber, asObject, asOptional, asString } from 'cleaners'

import { SoftPick } from '../../../util/typeUtil'
import { AddressPath } from '../../plugin/types'
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
