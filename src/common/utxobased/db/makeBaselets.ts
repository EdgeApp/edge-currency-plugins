import { Mutex } from 'async-mutex'
import {
  BaseType,
  createCountBase,
  createHashBase,
  createRangeBase,
  openBase
} from 'baselet'
import { CountBase } from 'baselet/src/CountBase'
import { HashBase } from 'baselet/src/HashBase'
import { RangeBase } from 'baselet/src/RangeBase'
import { Disklet } from 'disklet'

import {
  addressByScriptPubkeyConfig,
  addressPathByMRUConfig,
  RANGE_ID_KEY,
  RANGE_KEY,
  scriptPubkeyByPathConfig,
  scriptPubkeysByBalanceConfig,
  txByIdConfig,
  txIdsByBlockHeightConfig,
  txsByDateConfig,
  txsByScriptPubkeyConfig,
  utxoByIdConfig,
  utxoIdsByScriptPubkeyConfig,
  utxoIdsBySizeConfig
} from './Models/baselet'
import { Baselet, BaseletConfig } from './types'

async function createOrOpen(
  disklet: Disklet,
  config: BaseletConfig<BaseType.HashBase>
): Promise<HashBase>
async function createOrOpen(
  disklet: Disklet,
  config: BaseletConfig<BaseType.CountBase>
): Promise<CountBase>
async function createOrOpen(
  disklet: Disklet,
  config: BaseletConfig<BaseType.RangeBase>
): Promise<RangeBase>
async function createOrOpen<T extends BaseType>(
  disklet: Disklet,
  config: BaseletConfig<T>
): Promise<Baselet> {
  try {
    switch (config.type) {
      case BaseType.HashBase:
        return await createHashBase(disklet, config.dbName, config.bucketSize)
      case BaseType.CountBase:
        return await createCountBase(disklet, config.dbName, config.bucketSize)
      case BaseType.RangeBase:
        return await createRangeBase(
          disklet,
          config.dbName,
          config.bucketSize,
          RANGE_KEY,
          RANGE_ID_KEY
        )
    }
  } catch (err) {
    if (err instanceof Error && !err.message.includes('already exists')) {
      throw err
    }
  }
  return await openBase(disklet, config.dbName)
}

interface MakeBaseletsConfig {
  disklet: Disklet
}

export interface Baselets {
  address: <E extends Executor<'address'>>(fn: E) => Promise<ReturnType<E>>
  tx: <E extends Executor<'tx'>>(fn: E) => Promise<ReturnType<E>>
  utxo: <E extends Executor<'utxo'>>(fn: E) => Promise<ReturnType<E>>
  all: AddressTables & TransactionTables & UTXOTables
}

type Executor<DatabaseName extends keyof Databases> = (
  tables: Databases[DatabaseName]
) => Promise<unknown>

export interface Databases {
  address: AddressTables
  tx: TransactionTables
  utxo: UTXOTables
}

export interface AddressTables {
  addressByScriptPubkey: HashBase
  addressPathByMRU: CountBase
  scriptPubkeyByPath: CountBase
  scriptPubkeysByBalance: RangeBase
}

export interface TransactionTables {
  txById: HashBase
  txsByScriptPubkey: HashBase
  txIdsByBlockHeight: RangeBase
  txsByDate: RangeBase
}

export interface UTXOTables {
  utxoById: HashBase
  utxoIdsByScriptPubkey: HashBase
  utxoIdsBySize: RangeBase
}

export const makeBaselets = async (
  config: MakeBaseletsConfig
): Promise<Baselets> => {
  const addressMutex = new Mutex()
  const txMutex = new Mutex()
  const utxoMutex = new Mutex()

  const countBases = await Promise.all([
    createOrOpen(config.disklet, scriptPubkeyByPathConfig),
    createOrOpen(config.disklet, addressPathByMRUConfig)
  ])
  const rangeBases = await Promise.all([
    createOrOpen(config.disklet, scriptPubkeysByBalanceConfig),
    createOrOpen(config.disklet, txIdsByBlockHeightConfig),
    createOrOpen(config.disklet, txsByDateConfig),
    createOrOpen(config.disklet, utxoIdsBySizeConfig)
  ])
  const hashBases = await Promise.all([
    createOrOpen(config.disklet, addressByScriptPubkeyConfig),
    createOrOpen(config.disklet, txByIdConfig),
    createOrOpen(config.disklet, txsByScriptPubkeyConfig),
    createOrOpen(config.disklet, utxoByIdConfig),
    createOrOpen(config.disklet, utxoIdsByScriptPubkeyConfig)
  ])

  const [scriptPubkeyByPath, addressPathByMRU] = countBases
  const [
    scriptPubkeysByBalance,
    txIdsByBlockHeight,
    txsByDate,
    utxoIdsBySize
  ] = rangeBases
  const [
    addressByScriptPubkey,
    txById,
    txsByScriptPubkey,
    utxoById,
    utxoIdsByScriptPubkey
  ] = hashBases

  const addressBases: AddressTables = {
    addressByScriptPubkey,
    addressPathByMRU,
    scriptPubkeyByPath,
    scriptPubkeysByBalance
  }

  const txBases: TransactionTables = {
    txById,
    txsByScriptPubkey,
    txIdsByBlockHeight,
    txsByDate
  }

  const utxoBases: UTXOTables = {
    utxoById,
    utxoIdsByScriptPubkey,
    utxoIdsBySize
  }

  return {
    async address<E extends Executor<'address'>>(
      fn: E
    ): Promise<ReturnType<E>> {
      return await addressMutex.runExclusive(async () => await fn(addressBases))
    },

    async tx<E extends Executor<'tx'>>(fn: E): Promise<ReturnType<E>> {
      return await txMutex.runExclusive(async () => await fn(txBases))
    },

    async utxo<E extends Executor<'utxo'>>(fn: E): Promise<ReturnType<E>> {
      return await utxoMutex.runExclusive(async () => await fn(utxoBases))
    },

    all: {
      ...addressBases,
      ...txBases,
      ...utxoBases
    }
  }
}
