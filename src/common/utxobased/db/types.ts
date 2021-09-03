import { BaseType } from 'baselet'
import { CountBase } from 'baselet/src/CountBase'
import { HashBase } from 'baselet/src/HashBase'
import { RangeBase } from 'baselet/src/RangeBase'

import { AddressPath } from '../../plugin/types'
import { ScriptTypeEnum } from '../keymanager/keymanager'

export interface IAddress {
  scriptPubkey: string
  networkQueryVal: number
  path?: AddressPath
  lastQuery: number
  lastTouched: number
  used: boolean
  balance: string
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

export interface IProcessorTransaction {
  txid: string
  hex: string
  blockHeight: number
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
  scriptPubkey: string
}

export interface ITransactionInput extends ITransactionOutput {
  txId: string
  outputIndex: number
}

export interface BaseletConfig<T extends BaseType> {
  dbName: string
  type: T
  bucketSize: number
  range?: {
    id: string
    key: string
  }
}

export type Baselet = HashBase | CountBase | RangeBase
