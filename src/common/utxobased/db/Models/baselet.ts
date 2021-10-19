import {
  CountBase,
  CountBaseOptions,
  HashBase,
  HashBaseOptions,
  RangeBase,
  RangeBaseOptions
} from 'baselet'

import { AddressPath } from '../../../plugin/types'
import { IAddress, IProcessorTransaction, IUTXO } from '../types'

export const addressPathToPrefix = (
  path: Omit<AddressPath, 'addressIndex'>
): string => `${path.format}_${path.changeIndex}`

export type ScriptPubkeyByPathBaselet = CountBase<string>
export const scriptPubkeyByPathOptions: CountBaseOptions = {
  name: 'scriptPubkeyByPath',
  bucketSize: 50
}

export type AddressByScriptPubkeyBaselet = HashBase<IAddress>
export const addressByScriptPubkeyOptions: HashBaseOptions = {
  name: 'addressByScriptPubkey',
  prefixSize: 2
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
  name: 'TxIdByBlockHeight',
  bucketSize: 100000,
  rangeKey: 'blockHeight',
  idKey: 'txid'
}

export type TxByIdBaselet = HashBase<IProcessorTransaction>
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
  bucketSize: 30 * 24 * 60 * 60 * 1000,
  rangeKey: 'date',
  idKey: 'txid'
}

export type UtxoByIdBaselet = HashBase<IUTXO>
export const utxoByIdOptions: HashBaseOptions = {
  name: 'utxoById',
  prefixSize: 2
}

export type BlockHashByBlockHeightBaselet = HashBase<string>
export const blockHashByBlockHeightOptions: HashBaseOptions = {
  name: 'blockHashByBlockHeight',
  prefixSize: 2
}

export type UtxoIdsByScriptPubkeyBaselet = HashBase<string[]>
export const utxoIdsByScriptPubkeyOptions: HashBaseOptions = {
  name: 'utxoIdsByScriptPubkey',
  prefixSize: 2
}
