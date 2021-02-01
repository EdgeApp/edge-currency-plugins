import { BaseType } from 'baselet'
import { BaseletConfig, IAddress, IProcessorTransaction, IUTXO } from '../types'
import { AddressPath } from '../../../plugin/types'

export const RANGE_ID_KEY = 'idKey'
export const RANGE_KEY = 'rangeKey'

export const addressPathToPrefix = (path: Omit<AddressPath, 'addressIndex'>) =>
  `${path.format}_${path.changeIndex}`

export type ScriptPubkeyByPath = string | undefined
export const scriptPubkeyByPathConfig: BaseletConfig<BaseType.CountBase> = {
  dbName: 'scriptPubkeyByPath',
  type: BaseType.CountBase,
  bucketSize: 50
}

export type AddressByScriptPubkey = IAddress | undefined
export const addressByScriptPubkeyConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'addressByScriptPubkey',
  type: BaseType.HashBase,
  bucketSize: 6
}

export type AddressPathByMRU = string
export const addressPathByMRUConfig: BaseletConfig<BaseType.CountBase> = {
  dbName: 'addressPathByMRU',
  type: BaseType.CountBase,
  bucketSize: 100
}

export type ScriptPubkeysByBalance = {
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
  bucketSize: 2
}

export type TxsByScriptPubkey = {
  [hash: string]: {
    ins: { [index: number]: true }
    outs: { [index: number]: true }
  }
}
export const txsByScriptPubkeyConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'txsByScriptPubkey',
  type: BaseType.HashBase,
  bucketSize: 5
}

export type TxsByDate = {
  [RANGE_ID_KEY]: string
  [RANGE_KEY]: string
}
export const txsByDateConfig: BaseletConfig<BaseType.RangeBase> = {
  dbName: 'txsByDate',
  type: BaseType.RangeBase,
  bucketSize: 30 * 24 * 60 * 60 * 1000
}

export type UtxoById = IUTXO | undefined
export const utxoByIdConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'utxoById',
  type: BaseType.HashBase,
  bucketSize: 2
}

export type UtxosByScriptPubkey = Array<{
  hash: string
  vout: number
}>
export const utxoIdsByScriptPubkeyConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'utxoIdsByScriptPubkey',
  type: BaseType.HashBase,
  bucketSize: 6
}

export type UtxosBySize = {
  [RANGE_ID_KEY]: string
  [RANGE_KEY]: string
}
export const utxoIdsBySizeConfig: BaseletConfig<BaseType.RangeBase> = {
  dbName: 'utxoIdsBySize',
  type: BaseType.RangeBase,
  bucketSize: 100000
}
