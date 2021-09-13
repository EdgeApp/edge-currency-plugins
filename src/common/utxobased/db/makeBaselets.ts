import { Mutex } from 'async-mutex'
import {
  createOrOpenCountBase,
  createOrOpenHashBase,
  createOrOpenRangeBase
} from 'baselet'
import { Disklet } from 'disklet'

import {
  AddressByScriptPubkeyBaselet,
  addressByScriptPubkeyOptions,
  BlockHashByBlockHeightBaselet,
  blockHashByBlockHeightOptions,
  LastUsedByFormatPathBaselet,
  lastUsedByFormatPathOptions,
  ScriptPubkeyByPathBaselet,
  scriptPubkeyByPathOptions,
  TxByIdBaselet,
  txByIdOptions,
  TxIdByBlockHeightBaselet,
  TxIdByDateBaselet,
  txIdsByBlockHeightOptions,
  txIdsByDateOptions,
  UtxoByIdBaselet,
  utxoByIdOptions,
  UtxoIdsByScriptPubkeyBaselet,
  utxoIdsByScriptPubkeyOptions
} from './Models/baselet'

interface MakeBaseletsConfig {
  disklet: Disklet
}

type Executor<BaseletName extends keyof AllBaselets> = (
  tables: AllBaselets[BaseletName]
) => Promise<unknown>

interface AllBaselets {
  address: AddressBaselets
  tx: TransactionBaselets
  utxo: UtxoBaselets
  block: BlockBaselets
}

interface AddressBaselets {
  addressByScriptPubkey: AddressByScriptPubkeyBaselet
  scriptPubkeyByPath: ScriptPubkeyByPathBaselet
  lastUsedByFormatPath: LastUsedByFormatPathBaselet
}

interface TransactionBaselets {
  txById: TxByIdBaselet
  txIdsByBlockHeight: TxIdByBlockHeightBaselet
  txIdsByDate: TxIdByDateBaselet
}

interface UtxoBaselets {
  utxoById: UtxoByIdBaselet
  utxoIdsByScriptPubkey: UtxoIdsByScriptPubkeyBaselet
}

interface BlockBaselets {
  blockHashByBlockHeight: BlockHashByBlockHeightBaselet
}

export interface Baselets {
  address: <E extends Executor<'address'>>(fn: E) => Promise<ReturnType<E>>
  tx: <E extends Executor<'tx'>>(fn: E) => Promise<ReturnType<E>>
  utxo: <E extends Executor<'utxo'>>(fn: E) => Promise<ReturnType<E>>
  block: <E extends Executor<'block'>>(fn: E) => Promise<ReturnType<E>>

  all: AddressBaselets & TransactionBaselets & UtxoBaselets
}

export const makeBaselets = async (
  config: MakeBaseletsConfig
): Promise<Baselets> => {
  /* Tables */
  const addressBases: AddressBaselets = {
    addressByScriptPubkey: await createOrOpenHashBase(
      config.disklet,
      addressByScriptPubkeyOptions
    ),
    scriptPubkeyByPath: await createOrOpenCountBase(
      config.disklet,
      scriptPubkeyByPathOptions
    ),
    lastUsedByFormatPath: await createOrOpenHashBase(
      config.disklet,
      lastUsedByFormatPathOptions
    )
  }
  const txBases: TransactionBaselets = {
    txById: await createOrOpenHashBase(config.disklet, txByIdOptions),
    txIdsByBlockHeight: await createOrOpenRangeBase(
      config.disklet,
      txIdsByBlockHeightOptions
    ),
    txIdsByDate: await createOrOpenRangeBase(config.disklet, txIdsByDateOptions)
  }
  const utxoBases: UtxoBaselets = {
    utxoById: await createOrOpenHashBase(config.disklet, utxoByIdOptions),
    utxoIdsByScriptPubkey: await createOrOpenHashBase(
      config.disklet,
      utxoIdsByScriptPubkeyOptions
    )
  }
  const blockHeightBases: BlockBaselets = {
    blockHashByBlockHeight: await createOrOpenHashBase(
      config.disklet,
      blockHashByBlockHeightOptions
    )
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
      ...blockHeightBases
    }
  }
}
