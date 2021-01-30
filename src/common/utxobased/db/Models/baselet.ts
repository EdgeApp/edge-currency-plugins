import { BaseType } from 'baselet'
import { BaseletConfig, IAddress, IUTXO } from '../types'
import { ProcessorTransaction } from './ProcessorTransaction'
import { AddressPath } from '../../../plugin/types'

export const RANGE_ID_KEY = 'idKey'
export const RANGE_KEY = 'rangeKey'

export const addressPathToPrefix = (path: Omit<AddressPath, 'addressIndex'>) =>
  `${path.format}_${path.changeIndex}`

export type AddressByPath = IAddress | null
export const addressByPathConfig: BaseletConfig<BaseType.CountBase> = {
  dbName: 'addressByPath',
  type: BaseType.CountBase,
  bucketSize: 50
}

export type AddressPathByScriptPubKey = AddressPath
export const addressPathByScriptPubKeyConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'addressPathByScriptPubKey',
  type: BaseType.HashBase,
  bucketSize: 6
}

export type AddressPathByMRU = string
export const addressPathByMRUConfig: BaseletConfig<BaseType.CountBase> = {
  dbName: 'addressPathByMRU',
  type: BaseType.CountBase,
  bucketSize: 100
}

export type TxIdsByConfirmations = string[]
export const txIdsByConfirmationsConfig: BaseletConfig<BaseType.CountBase> = {
  dbName: 'txIdByConfirmations',
  type: BaseType.CountBase,
  bucketSize: 1
}

export type ScriptPubKeysByBalance = {
  [RANGE_ID_KEY]: string
  [RANGE_KEY]: string
}
export const scriptPubKeysByBalanceConfig: BaseletConfig<BaseType.RangeBase> = {
  dbName: 'scriptPubKeysByBalance',
  type: BaseType.RangeBase,
  bucketSize: 100000
}

export type TxById = ProcessorTransaction | null
export const txByIdConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'txById',
  type: BaseType.HashBase,
  bucketSize: 2
}

export type TxsByScriptPubKey = {
  [hash: string]: {
    ins: { [index: number]: true }
    outs: { [index: number]: true }
  }
}
export const txsByScriptPubKeyConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'txsByScriptPubKey',
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

export type UtxoById = IUTXO | null
export const utxoByIdConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'utxoById',
  type: BaseType.HashBase,
  bucketSize: 2
}

export type UtxosByScriptPubKey = Array<{
  hash: string
  vout: number
}>
export const utxoIdsByScriptPubKeyConfig: BaseletConfig<BaseType.HashBase> = {
  dbName: 'utxoIdsByScriptPubKey',
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
