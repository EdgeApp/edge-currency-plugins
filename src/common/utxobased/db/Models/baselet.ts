import { BaseType } from 'baselet'

import { AddressPath } from '../../../plugin/types'
import { BaseletConfig, IAddress, IProcessorTransaction, IUTXO } from '../types'

// deprecated
export const RANGE_ID_KEY = 'idKey'
// deprecated
export const RANGE_KEY = 'rangeKey'

export const addressPathToPrefix = (
  path: Omit<AddressPath, 'addressIndex'>
): string => `${path.format}_${path.changeIndex}`

export type ScriptPubkeyByPath = string | undefined
export const scriptPubkeyByPathConfig: BaseletConfig<BaseType.CountBase> = {
  dbName: 'scriptPubkeyByPath',
  type: BaseType.CountBase,
  bucketSize: 50
}

// deprecated
export type UsedFlagByScriptPubkey = boolean
export const usedFlagByScriptPubkeyConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'usedFlagByScriptPubkey',
  type: BaseType.HashBase,
  bucketSize: 50
}

export type AddressByScriptPubkey = IAddress | undefined
export const addressByScriptPubkeyConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'addressByScriptPubkey',
  type: BaseType.HashBase,
  bucketSize: 8
}

export type LastUsedByFormatPath = number | undefined
export const lastUsedByFormatPathConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'lastUsedByFormatPath',
  type: BaseType.HashBase,
  bucketSize: 8
}

// deprectated
export type AddressPathByMRU = string
export const addressPathByMRUConfig: BaseletConfig<BaseType.CountBase> = {
  dbName: 'addressPathByMRU',
  type: BaseType.CountBase,
  bucketSize: 100
}

export interface TxIdsByBlockHeight {
  [RANGE_ID_KEY]: string
  [RANGE_KEY]: string
}
export const txIdsByBlockHeightConfig: BaseletConfig<BaseType.RangeBase> = {
  dbName: 'txIdByConfirmations',
  type: BaseType.RangeBase,
  bucketSize: 100000,
  range: {
    // deprecated - change to 'txIds'
    id: RANGE_ID_KEY,
    // deprecated - change to 'blockHeights'
    key: RANGE_KEY
  }
}

// deprecated
export interface ScriptPubkeysByBalance {
  [RANGE_ID_KEY]: string
  [RANGE_KEY]: string
}
export const scriptPubkeysByBalanceConfig: BaseletConfig<BaseType.RangeBase> = {
  dbName: 'scriptPubkeysByBalance',
  type: BaseType.RangeBase,
  bucketSize: 100000
}

export type TxById = IProcessorTransaction | undefined
export const txByIdConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'txById',
  type: BaseType.HashBase,
  bucketSize: 6
}

// deprecated
export interface TxsByScriptPubkey {
  [hash: string]: {
    ins: { [index: number]: true }
    outs: { [index: number]: true }
  }
}
export const txsByScriptPubkeyConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'txsByScriptPubkey',
  type: BaseType.HashBase,
  bucketSize: 8
}

// deprecated - use TxIdsByDate instead
export type TxsByDate = TxByDate[]
interface TxByDate {
  [RANGE_ID_KEY]: string
  [RANGE_KEY]: string
}
export const txsByDateConfig: BaseletConfig<BaseType.RangeBase> = {
  dbName: 'txsByDate',
  type: BaseType.RangeBase,
  bucketSize: 30 * 24 * 60 * 60 * 1000
}

export const txIdsByDateRangeKey = 'date'
export const txIdsByDateRangeId = 'txId'
export type TxIdsByDate = TxIdByDate[]
interface TxIdByDate {
  [txIdsByDateRangeKey]: string
  [txIdsByDateRangeId]: string
}
export const txIdsByDateConfig: BaseletConfig<BaseType.RangeBase> = {
  dbName: 'txIdsByDate',
  type: BaseType.RangeBase,
  bucketSize: 30 * 24 * 60 * 60 * 1000,
  range: {
    id: txIdsByDateRangeKey,
    key: txIdsByDateRangeId
  }
}

export type UtxoById = IUTXO | undefined
export const utxoByIdConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'utxoById',
  type: BaseType.HashBase,
  bucketSize: 6
}

export type BlockHashByBlockHeight = string
export const blockHashByBlockHeightConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'blockHashByBlockHeight',
  type: BaseType.HashBase,
  bucketSize: 30 * 24 * 60 * 60 * 1000
}

// deprecated
export type UtxosByScriptPubkey = Array<{
  hash: string
  vout: number
}>
export const utxoIdsByScriptPubkeyConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'utxoIdsByScriptPubkey',
  type: BaseType.HashBase,
  bucketSize: 8
}

// deprecated
export interface UtxosBySize {
  [RANGE_ID_KEY]: string
  [RANGE_KEY]: string
}
export const utxoIdsBySizeConfig: BaseletConfig<BaseType.RangeBase> = {
  dbName: 'utxoIdsBySize',
  type: BaseType.RangeBase,
  bucketSize: 100000
}

// deprecated
export type SpentUtxoById = IUTXO | undefined
export const spentUtxoByIdConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'spentUtxoById',
  type: BaseType.HashBase,
  bucketSize: 6
}
