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
  blockHashByBlockHeightConfig,
  lastUsedByFormatPathConfig,
  RANGE_ID_KEY,
  RANGE_KEY,
  scriptPubkeyByPathConfig,
  scriptPubkeysByBalanceConfig,
  spentUtxoByIdConfig,
  txByIdConfig,
  txIdsByBlockHeightConfig,
  txIdsByDateConfig,
  txsByDateConfig,
  txsByScriptPubkeyConfig,
  usedFlagByScriptPubkeyConfig,
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
        if (config.range == null) {
          config.range = {
            key: RANGE_KEY,
            id: RANGE_ID_KEY
          }
        }
        return await createRangeBase(
          disklet,
          config.dbName,
          config.bucketSize,
          config.range.key,
          config.range.id
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
  block: <E extends Executor<'block'>>(fn: E) => Promise<ReturnType<E>>

  all: AddressTables & TransactionTables & UTXOTables & SpentUTXOTables
}

type Executor<DatabaseName extends keyof Databases> = (
  tables: Databases[DatabaseName]
) => Promise<unknown>

export interface Databases {
  address: AddressTables
  tx: TransactionTables
  utxo: UTXOTables
  block: BlockTables
}

export interface AddressTables {
  addressByScriptPubkey: HashBase
  // deprecated
  addressPathByMRU: CountBase
  scriptPubkeyByPath: CountBase
  // deprecated
  scriptPubkeysByBalance: RangeBase
  // deprecated
  usedFlagByScriptPubkey: HashBase
  lastUsedByFormatPath: HashBase
}

export interface TransactionTables {
  txById: HashBase
  // deprecated
  txsByScriptPubkey: HashBase
  txIdsByBlockHeight: RangeBase
  // deprecated - use txIdsByDate instead
  txsByDate: RangeBase
  txIdsByDate: RangeBase
}

export interface UTXOTables {
  utxoById: HashBase
  // deprecated
  utxoIdsByScriptPubkey: HashBase
  // deprecated
  utxoIdsBySize: RangeBase
}

export interface BlockTables {
  blockHashByBlockHeight: HashBase
}

// deprecated
interface SpentUTXOTables {
  spentUtxoById: HashBase
}

export const makeBaselets = async (
  config: MakeBaseletsConfig
): Promise<Baselets> => {
  /* CountBases */
  const scriptPubkeyByPath = await createOrOpen(
    config.disklet,
    scriptPubkeyByPathConfig
  )
  // deprecated
  const addressPathByMRU = await createOrOpen(
    config.disklet,
    addressPathByMRUConfig
  )

  /* RangeBases */
  // deprecated
  const scriptPubkeysByBalance = await createOrOpen(
    config.disklet,
    scriptPubkeysByBalanceConfig
  )
  const txIdsByBlockHeight = await createOrOpen(
    config.disklet,
    txIdsByBlockHeightConfig
  )
  // deprecated - use txIdsByDate instead
  const txsByDate = await createOrOpen(config.disklet, txsByDateConfig)
  const txIdsByDate = await createOrOpen(config.disklet, txIdsByDateConfig)
  // deprecated
  const utxoIdsBySize = await createOrOpen(config.disklet, utxoIdsBySizeConfig)

  /* HashBases */
  const addressByScriptPubkey = await createOrOpen(
    config.disklet,
    addressByScriptPubkeyConfig
  )
  const txById = await createOrOpen(config.disklet, txByIdConfig)
  const txsByScriptPubkey = await createOrOpen(
    config.disklet,
    txsByScriptPubkeyConfig
  )
  const utxoById = await createOrOpen(config.disklet, utxoByIdConfig)
  // deprecated
  const spentUtxoById = await createOrOpen(config.disklet, spentUtxoByIdConfig)
  // deprecated
  const utxoIdsByScriptPubkey = await createOrOpen(
    config.disklet,
    utxoIdsByScriptPubkeyConfig
  )
  // deprecated
  const usedFlagByScriptPubkey = await createOrOpen(
    config.disklet,
    usedFlagByScriptPubkeyConfig
  )
  const blockHashByBlockHeight = await createOrOpen(
    config.disklet,
    blockHashByBlockHeightConfig
  )
  const lastUsedByFormatPath = await createOrOpen(
    config.disklet,
    lastUsedByFormatPathConfig
  )

  const addressBases: AddressTables = {
    addressByScriptPubkey,
    addressPathByMRU,
    scriptPubkeyByPath,
    scriptPubkeysByBalance,
    usedFlagByScriptPubkey,
    lastUsedByFormatPath
  }

  const txBases: TransactionTables = {
    txById,
    txsByScriptPubkey,
    txIdsByBlockHeight,
    txsByDate,
    txIdsByDate
  }

  const utxoBases: UTXOTables = {
    utxoById,
    utxoIdsByScriptPubkey,
    utxoIdsBySize
  }

  const spentUtxoBases: SpentUTXOTables = {
    spentUtxoById
  }

  const blockHeightBases: BlockTables = {
    blockHashByBlockHeight
  }

  const addressMutex = new Mutex()
  const txMutex = new Mutex()
  const utxoMutex = new Mutex()

  return {
    async address(fn): Promise<ReturnType<typeof fn>> {
      return await addressMutex.runExclusive(async () => await fn(addressBases))
    },

    async tx(fn): Promise<ReturnType<typeof fn>> {
      return await txMutex.runExclusive(async () => await fn(txBases))
    },

    async utxo(fn): Promise<ReturnType<typeof fn>> {
      return await utxoMutex.runExclusive(async () => await fn(utxoBases))
    },

    async block(fn): Promise<ReturnType<typeof fn>> {
      return await fn(blockHeightBases)
    },

    all: {
      ...addressBases,
      ...txBases,
      ...utxoBases,
      ...blockHeightBases,
      ...spentUtxoBases
    }
  }
}
