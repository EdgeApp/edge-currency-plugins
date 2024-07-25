import {
  CountBase,
  CountBaseOptions,
  HashBase,
  HashBaseOptions,
  RangeBase,
  RangeBaseOptions
} from 'baselet'

import { ChangePath } from '../../../plugin/types'
import { AddressData, TransactionData, UtxoData } from '../types'

export const addressPathToPrefix = (path: ChangePath): string =>
  `${path.format}_${path.changeIndex}`

export type ScriptPubkeyByPathBaselet = CountBase<string>
export const scriptPubkeyByPathOptions: CountBaseOptions = {
  name: 'scriptPubkeyByPath',
  bucketSize: 50
}

export type AddressByScriptPubkeyBaselet = HashBase<AddressData>
export const addressByScriptPubkeyOptions: HashBaseOptions = {
  name: 'addressByScriptPubkey',
  prefixSize: 4
}

export type LastUsedByFormatPathBaselet = HashBase<number>
export const lastUsedByFormatPathOptions: HashBaseOptions = {
  name: 'lastUsedByFormatPath',
  prefixSize: 2
}

export interface TxIdByBlockHeight {
  txid: string
  blockHeight: number
}
export type TxIdByBlockHeightBaselet = RangeBase<
  TxIdByBlockHeight,
  'blockHeight',
  'txid'
>
export const txIdsByBlockHeightOptions: RangeBaseOptions<
  'blockHeight',
  'txid'
> = {
  name: 'txIdByBlockHeight',
  bucketSize: 100000,
  rangeKey: 'blockHeight',
  idKey: 'txid'
}

export type TxByIdBaselet = HashBase<TransactionData>
export const txByIdOptions: HashBaseOptions = {
  name: 'txById',
  prefixSize: 2
}

export interface TxIdByDate {
  txid: string
  date: number
}
export type TxIdByDateBaselet = RangeBase<TxIdByDate, 'date', 'txid'>
export const txIdsByDateOptions: RangeBaseOptions<'date', 'txid'> = {
  name: 'txIdsByDate',
  bucketSize: 30 * 24 * 60 * 60, // 30 days
  rangeKey: 'date',
  idKey: 'txid'
}

export type UtxoByIdBaselet = HashBase<UtxoData>
export const utxoByIdOptions: HashBaseOptions = {
  name: 'utxoById',
  prefixSize: 2
}

export type UtxoIdsByScriptPubkeyBaselet = HashBase<string[]>
export const utxoIdsByScriptPubkeyOptions: HashBaseOptions = {
  name: 'utxoIdsByScriptPubkey',
  prefixSize: 4
}
