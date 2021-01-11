import { BaseType } from 'baselet'
import { HashBase } from 'baselet/src/HashBase'
import { CountBase } from 'baselet/src/CountBase'
import { RangeBase } from 'baselet/src/RangeBase'
import { ScriptTypeEnum } from '../keymanager/keymanager'
import { AddressPath } from '../../plugin/types'

export type IAddress = Required<IAddressPartial>

export interface IAddressPartial extends IAddressRequired, IAddressOptional {
}

export interface IAddressRequired {
  scriptPubKey: string
  networkQueryVal: number
  path: AddressPath
}

export interface IAddressOptional {
  lastQuery?: number
  lastTouched?: number
  used?: boolean
  balance?: string
}

export interface IUTXO {
  id: string
  txid: string
  vout: number
  value: string
  scriptPubKey: string
  script: string
  redeemScript?: string
  scriptType: ScriptTypeEnum
  blockHeight: number
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
  scriptPubKey: string
}

export interface ITransactionInput extends ITransactionOutput {
  txId: string
  outputIndex: number
}

export interface BaseletConfig<T extends BaseType> {
  dbName: string
  type: T
  bucketSize: number
}

export type Baselet = HashBase | CountBase | RangeBase
