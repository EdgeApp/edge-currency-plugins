import { AddressPath } from '../../plugin/types'
import { ScriptTypeEnum } from '../keymanager/keymanager'

export interface IAddress {
  scriptPubkey: string
  lastQueriedBlockHeight: number
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
  n: number
}

export interface ITransactionInput extends ITransactionOutput {
  txId: string
  outputIndex: number
}
