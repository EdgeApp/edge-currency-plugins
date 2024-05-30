import { asBoolean, asNumber, asObject, asOptional, asString } from 'cleaners'

import { SoftPick } from '../../../util/typeUtil'
import { AddressPath } from '../../plugin/types'
import { asScriptTypeEnum, ScriptTypeEnum } from '../keymanager/keymanager'

export interface IAddress {
  scriptPubkey: string
  redeemScript?: string
  lastQueriedBlockHeight: number
  path?: AddressPath
  lastQuery: number
  lastTouched: number
  used: boolean
  balance?: string
}

export const makeIAddress = (
  addressFields: SoftPick<IAddress, 'scriptPubkey'>
): IAddress => {
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

export interface IUTXO {
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
export const asIUTXO = asObject<IUTXO>({
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

export interface IProcessorTransaction {
  txid: string
  hex: string
  blockHeight: number
  confirmations?: 'confirmed' | 'unconfirmed' | 'dropped' | number
  date: number
  fees: string
  inputs: ITransactionInput[]
  outputs: ITransactionOutput[]
  ourIns: string[]
  ourOuts: string[]
  ourAmount: string
}

export interface ITransactionOutput {
  amount: string
  n: number
  scriptPubkey: string
}

export interface ITransactionInput {
  amount: string
  n: number
  outputIndex: number
  scriptPubkey: string
  txId: string
}
