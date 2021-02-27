import { BaseType, createCountBase, createHashBase, createRangeBase, openBase } from 'baselet'
import { CountBase } from 'baselet/src/CountBase'
import { HashBase } from 'baselet/src/HashBase'
import { RangeBase } from 'baselet/src/RangeBase'
import * as bs from 'biggystring'
import { Disklet } from 'disklet'

import { Baselet, BaseletConfig, IAddress, IProcessorTransaction, IUTXO } from './types'
import { makeQueue } from './makeQueue'
import { AddressPath, EmitterEvent } from '../../plugin/types'
import {
  AddressByScriptPubkey,
  addressByScriptPubkeyConfig,
  addressPathByMRUConfig,
  addressPathToPrefix,
  RANGE_ID_KEY,
  RANGE_KEY,
  ScriptPubkeyByPath,
  scriptPubkeyByPathConfig,
  ScriptPubkeysByBalance,
  scriptPubkeysByBalanceConfig,
  TxIdsByBlockHeight,
  txIdsByBlockHeightConfig,
  TxById,
  txByIdConfig,
  txsByDateConfig,
  TxsByScriptPubkey,
  txsByScriptPubkeyConfig,
  UtxoById,
  utxoByIdConfig,
  utxoIdsByScriptPubkeyConfig,
  utxoIdsBySizeConfig
} from './Models/baselet'
import { EdgeGetTransactionsOptions } from 'edge-core-js/lib/types'

interface ProcessorEmitter {
  emit(event: EmitterEvent.PROCESSOR_TRANSACTION_CHANGED, transaction: IProcessorTransaction): this
}

interface ProcessorConfig {
  disklet: Disklet
  emitter: ProcessorEmitter,
}

export interface Processor {
  fetchScriptPubkeyByPath(path: AddressPath): Promise<ScriptPubkeyByPath>

  fetchAddressByScriptPubkey(scriptPubkey: string): Promise<AddressByScriptPubkey>

  hasSPubKey(scriptPubkey: string): Promise<boolean>

  fetchAddressesByPath(path: Omit<AddressPath, 'addressIndex'>): Promise<AddressByScriptPubkey[]>

  fetchAddressCountFromPathPartition(path: Omit<AddressPath, 'addressIndex'>): number

  fetchScriptPubkeysByBalance(): Promise<ScriptPubkeysByBalance[]>

  saveAddress(data: IAddress): Promise<void>

  updateAddressByScriptPubkey(scriptPubkey: string, data: Partial<IAddress>): Promise<void>

  fetchTxIdsByBlockHeight(blockHeightMin: number, blockHeightMax?: number): Promise<string[]>

  insertTxIdByBlockHeight(blockHeight: number, data: string): Promise<void>

  removeTxIdByBlockHeight(blockHeight: number, txId: string): Promise<void>

  fetchTransaction(txId: string): Promise<TxById>

  fetchTransactionsByScriptPubkey(scriptHash: string): Promise<TxsByScriptPubkey>

  fetchTransactions(opts: EdgeGetTransactionsOptions): Promise<IProcessorTransaction[]>

  saveTransaction(tx: IProcessorTransaction, withQueue?: boolean): Promise<void>

  updateTransaction(txId: string, data: Pick<IProcessorTransaction, 'blockHeight'>): void

  dropTransaction(txId: string): void

  fetchUtxo(id: string): Promise<UtxoById>

  fetchUtxosByScriptPubkey(scriptPubkey: string): Promise<IUTXO[]>

  fetchAllUtxos(): Promise<IUTXO[]>

  saveUtxo(utxo: IUTXO): void

  removeUtxo(utxo: IUTXO): void
}

async function createOrOpen(disklet: Disklet, config: BaseletConfig<BaseType.HashBase>): Promise<HashBase>
async function createOrOpen(disklet: Disklet, config: BaseletConfig<BaseType.CountBase>): Promise<CountBase>
async function createOrOpen(disklet: Disklet, config: BaseletConfig<BaseType.RangeBase>): Promise<RangeBase>
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
        return await createRangeBase(disklet, config.dbName, config.bucketSize, RANGE_KEY, RANGE_ID_KEY)
    }
  } catch (err) {
    if (!err.message.includes('already exists')) {
      throw err
    }
  }
  return openBase(disklet, config.dbName)
}

export async function makeProcessor(config: ProcessorConfig): Promise<Processor> {
  const queue = makeQueue()
  const {
    disklet,
    emitter
  } = config

  const countBases = Promise.all([
    createOrOpen(disklet, scriptPubkeyByPathConfig),
    createOrOpen(disklet, addressPathByMRUConfig),
  ])
  const rangeBases = Promise.all([
    createOrOpen(disklet, scriptPubkeysByBalanceConfig),
    createOrOpen(disklet, txIdsByBlockHeightConfig),
    createOrOpen(disklet, txsByDateConfig),
    createOrOpen(disklet, utxoIdsBySizeConfig)
  ])
  const hashBases = Promise.all([
    createOrOpen(disklet, addressByScriptPubkeyConfig),
    createOrOpen(disklet, txByIdConfig),
    createOrOpen(disklet, txsByScriptPubkeyConfig),
    createOrOpen(disklet, utxoByIdConfig),
    createOrOpen(disklet, utxoIdsByScriptPubkeyConfig)
  ])
  await Promise.all([countBases, rangeBases, hashBases])

  const [
    scriptPubkeyByPath,
    addressPathByMRU
  ] = await countBases
  const [
    scriptPubkeysByBalance,
    txIdsByBlockHeight,
    txsByDate,
    utxoIdsBySize
  ] = await rangeBases
  const [
    addressByScriptPubkey,
    txById,
    txsByScriptPubkey,
    utxoById,
    utxoIdsByScriptPubkey
  ] = await hashBases

  async function processAndSaveAddress(data: IAddress) {
    const [ addressData ] = await addressByScriptPubkey.query('', [ data.scriptPubkey ])
    if (addressData != null) {
      throw new Error('Address already exists. To update its data call `updateAddressByScriptPubkey`')
    }

    // If there is path info on the address to save but not stored in
    // the previously existing data, save to the by path database.
    if (data.path && !addressData?.path) {
      await innerSaveScriptPubkeyByPath(data.scriptPubkey, data.path)
    }

    try {
      await Promise.all([
        addressByScriptPubkey.insert(
          '',
          data.scriptPubkey,
          data
        ),

        scriptPubkeysByBalance.insert('', {
          [RANGE_ID_KEY]: data.scriptPubkey,
          [RANGE_KEY]: parseInt(data.balance)
        }),

        // TODO: change to rangebase
        // addressByMRU.insert('', index, data)
      ])

      await processScriptPubkeyTransactions(data.scriptPubkey)
    } catch (err) {
      // Undo any changes we made on a fail
      await Promise.all([
        scriptPubkeysByBalance.delete('', parseInt(data.balance), data.scriptPubkey),

        addressByScriptPubkey.delete('', [ data.scriptPubkey ]),

        // TODO:
        // addressByMRU.delete()
      ])
    }
  }

  // Find transactions associated with this scriptPubkey, process the balances and save it
  async function processScriptPubkeyTransactions(scriptPubkey: string): Promise<void> {
    const byScriptPubkey = await fns.fetchTransactionsByScriptPubkey(scriptPubkey)
    for (const txId in byScriptPubkey) {
      const tx = byScriptPubkey[txId]
      const txData = await fns.fetchTransaction(txId)
      if (txData) {
        txData.ourIns = Object.keys(tx.ins)
        txData.ourOuts = Object.keys(tx.outs)

        await fns.updateAddressByScriptPubkey(scriptPubkey, {
          lastTouched: txData.date,
          used: true
        })

        txData.ourAmount = await calculateTransactionAmount(txData)
        await innerUpdateTransaction(txId, txData, true)
      }
    }
  }

  async function innerFetchAddressesByScriptPubkeys(scriptPubkeys: string[]): Promise<AddressByScriptPubkey[]> {
    if (scriptPubkeys.length === 0) return []
    const addresses: AddressByScriptPubkey[] = await addressByScriptPubkey.query('', scriptPubkeys)

    // Update the last query values
    const now = Date.now()
    addresses.map(async (address) => {
      if (address) {
        return innerUpdateAddressByScriptPubkey(address.scriptPubkey, {
          lastQuery: now
        })
      }
    })

    return addresses
  }

  async function saveTransactionByScriptPubkey(
    scriptPubkey: string,
    tx: IProcessorTransaction,
    isInput: boolean,
    index: number,
    save = true
  ) {
    const txs = await fns.fetchTransactionsByScriptPubkey(scriptPubkey)
    if (!txs[tx.txid]) {
      txs[tx.txid] = {
        ins: {},
        outs: {}
      }
    }
    if (save) {
      if (isInput) {
        txs[tx.txid].ins[index] = true
      } else {
        txs[tx.txid].outs[index] = true
      }
    } else {
      if (isInput) {
        delete txs[tx.txid].ins[index]
      } else {
        delete txs[tx.txid].outs[index]
      }
    }

    await txsByScriptPubkey.insert('', scriptPubkey, txs)

    return txs
  }

  async function calculateTransactionAmount(tx: IProcessorTransaction): Promise<string> {
    let ourAmount = '0'
    for (const i of tx.ourIns) {
      const { amount } = tx.inputs[parseInt(i)]
      ourAmount = bs.sub(ourAmount, amount)
    }
    for (const i of tx.ourOuts) {
      const { amount } = tx.outputs[parseInt(i)]
      ourAmount = bs.add(ourAmount, amount)
    }

    return ourAmount
  }

  async function innerSaveScriptPubkeyByPath(scriptPubkey: string, path: AddressPath): Promise<void> {
    await scriptPubkeyByPath.insert(
      addressPathToPrefix(path),
      path.addressIndex,
      scriptPubkey
    )
  }

  async function innerUpdateAddressByScriptPubkey(scriptPubkey: string, data: Partial<IAddress>): Promise<IAddress> {
    const [ address ] = await addressByScriptPubkey.query('', [ scriptPubkey ])
    if (!address) {
      throw new Error('Cannot update address that does not exist')
    }

    const promises: Promise<any>[] = []

    if (
      data.networkQueryVal != null &&
      data.networkQueryVal > address.networkQueryVal
    ) {
      address.networkQueryVal = data.networkQueryVal
    }

    if (data.lastQuery != null && data.lastQuery > address.lastQuery) {
      address.lastQuery = data.lastQuery
    }

    if (data.lastTouched != null && data.lastTouched > address.lastTouched) {
      address.lastTouched = data.lastTouched
    }

    if (data.used && !address.used) {
      address.used = data.used
    }

    if (data.balance != null && data.balance !== address.balance) {
      const oldRange = parseInt(address.balance)
      address.balance = data.balance
      promises.push(
        scriptPubkeysByBalance.update('', oldRange, {
          [RANGE_ID_KEY]: address.scriptPubkey,
          [RANGE_KEY]: parseInt(data.balance)
        })
      )
    }

    if (data.path != null && address.path == null) {
      promises.push(
        innerSaveScriptPubkeyByPath(scriptPubkey, data.path)
      )
    }

    await Promise.all([
      ...promises,
      addressByScriptPubkey.insert('', address.scriptPubkey, address)
    ])

    return address
  }

  async function innerSaveTransaction(tx: IProcessorTransaction): Promise<void> {
    const existingTx = await fns.fetchTransaction(tx.txid)
    if (!existingTx) {
      await txsByDate.insert('', {
        [RANGE_ID_KEY]: tx.txid,
        [RANGE_KEY]: tx.date
      })
    }

    for (const inOout of [ true, false ]) {
      const arr = inOout ? tx.inputs : tx.outputs
      for (let i = 0; i < arr.length; i++) {
        const { scriptPubkey, amount } = arr[i]

        const txs = await saveTransactionByScriptPubkey(scriptPubkey, tx, inOout, i)
        const own = await fns.hasSPubKey(scriptPubkey)
        if (own) {
          if (inOout) {
            tx.ourIns = Object.keys(txs[tx.txid].ins)
          } else {
            tx.ourOuts = Object.keys(txs[tx.txid].outs)
          }

          await innerUpdateAddressByScriptPubkey(scriptPubkey, {
            lastTouched: tx.date,
            used: true
          })
        }
      }
    }
    await fns.insertTxIdByBlockHeight(tx.blockHeight, tx.txid)

    tx.ourAmount = await calculateTransactionAmount(tx)
    await txById.insert('', tx.txid, tx)
  }

  async function innerUpdateTransaction(
    txId: string,
    data: IProcessorTransaction,
    merge = false
  ) {
    let txData = await fns.fetchTransaction(txId)
    if (!txData && !merge) {
      throw new Error('Cannot update transaction that does not exists')
    } else {
      txData = data
    }
    if (txData.blockHeight < data.blockHeight) {
      await fns.removeTxIdByBlockHeight(txData.blockHeight, data.txid)
      await fns.insertTxIdByBlockHeight(data.blockHeight, txId)
    }
    txData.blockHeight = data.blockHeight

    if (merge) {
      const ins = new Set(txData.ourIns.concat(data.ourIns))
      const outs = new Set(txData.ourOuts.concat(data.ourOuts))
      txData.ourIns = Array.from(ins)
      txData.ourOuts = Array.from(outs)
    } else {
      txData.ourIns = data.ourIns
      txData.ourOuts = data.ourOuts
    }

    txData.ourAmount = data.ourAmount

    emitter.emit(EmitterEvent.PROCESSOR_TRANSACTION_CHANGED, txData)

    await txById.insert('', txId, txData)
  }

  async function innerDropTransaction(txId: string) {
    const tx = await fns.fetchTransaction(txId)
    if (!tx) return

    for (let i = 0; i < tx.inputs.length; i++) {
      const input = tx.inputs[i]

      await saveTransactionByScriptPubkey(input.scriptPubkey, tx, true, i, false)
    }

    for (let i = 0; i < tx.outputs.length; i++) {
      const output = tx.outputs[i]

      await saveTransactionByScriptPubkey(output.scriptPubkey, tx, false, i, false)
    }

    await fns.removeTxIdByBlockHeight(tx.blockHeight, tx.txid)

    tx.blockHeight = -1
    await txById.insert('', tx.txid, tx)

    // TODO: recalculate balances
  }

  async function innerSaveUtxo(utxo: IUTXO) {
    await utxoById.insert('', utxo.id, utxo)
    await utxoIdsBySize.insert('', {
      [RANGE_ID_KEY]: utxo.id,
      [RANGE_KEY]: parseInt(utxo.value)
    })

    const [ utxoIds ] = await utxoIdsByScriptPubkey.query('', [ utxo.scriptPubkey ])
    const set = new Set(utxoIds)
    set.add(utxo.id)
    await utxoIdsByScriptPubkey.insert('', utxo.scriptPubkey, Array.from(set))
  }

  async function innerRemoveUtxo(utxo: IUTXO) {
    await utxoById.delete('', [ utxo.id ])
    await utxoIdsBySize.delete('', parseInt(utxo.value), utxo.id)
    await utxoIdsByScriptPubkey.delete('', [ utxo.scriptPubkey ])
  }

  const fns: Processor = {
    async fetchScriptPubkeyByPath(path: AddressPath): Promise<ScriptPubkeyByPath> {
      const [ scriptPubkey ] = await scriptPubkeyByPath.query(
        addressPathToPrefix(path),
        path.addressIndex
      )
      return scriptPubkey
    },

    async fetchTxIdsByBlockHeight(blockHeightMin: number, blockHeightMax?: number): Promise<string[]> {
      const result = await txIdsByBlockHeight.query(
        '',
        blockHeightMin,
        blockHeightMax
      )
      return result.map(({ [RANGE_ID_KEY]: id }) => id)
    },

    async insertTxIdByBlockHeight(
      blockHeight: number,
      txId: string
    ): Promise<void> {
      const data = await this.fetchTxIdsByBlockHeight(blockHeight)
      if (data.includes(txId)) {
        return
      }
      await txIdsByBlockHeight.insert('', {
        [RANGE_ID_KEY]: txId,
        [RANGE_KEY]: blockHeight
      })
    },

    async removeTxIdByBlockHeight(
      blockHeight: number,
      txId: string
    ): Promise<void> {
      const data = await this.fetchTxIdsByBlockHeight(blockHeight)
      if (data === []) {
        return
      }
      await txIdsByBlockHeight.delete('', blockHeight, txId)
    },

    async fetchAddressByScriptPubkey(scriptPubkey: string): Promise<AddressByScriptPubkey> {
      const [ address ] = await innerFetchAddressesByScriptPubkeys([ scriptPubkey ])
      return address
    },

    async hasSPubKey(scriptPubkey: string): Promise<boolean> {
      return fns.fetchAddressByScriptPubkey(scriptPubkey).then(
        (address) => !!address
      )
    },

    async fetchAddressesByPath(path: Omit<AddressPath, 'addressIndex'>): Promise<AddressByScriptPubkey[]> {
      const scriptPubkeys = await scriptPubkeyByPath.query(addressPathToPrefix(path), 0)
      return innerFetchAddressesByScriptPubkeys(scriptPubkeys)
    },

    fetchAddressCountFromPathPartition(path: Omit<AddressPath, 'addressIndex'>): number {
      return scriptPubkeyByPath.length(addressPathToPrefix(path))
    },

    // Returned in lowest first due to RangeBase
    async fetchScriptPubkeysByBalance(): Promise<ScriptPubkeysByBalance[]> {
      const max = scriptPubkeysByBalance.max('') ?? 0
      return scriptPubkeysByBalance.query('', 0, max)
    },

    async saveAddress(data: IAddress): Promise<void> {
      await processAndSaveAddress(data)
    },

    async updateAddressByScriptPubkey(
      scriptPubkey: string,
      data: Partial<IAddress>
    ): Promise<void> {
      await innerUpdateAddressByScriptPubkey(scriptPubkey, data)
    },

    async fetchTransaction(txId: string): Promise<TxById> {
      const [ data ] = await txById.query('', [ txId ])
      return data
    },

    async fetchTransactionsByScriptPubkey(
      scriptHash: string
    ): Promise<TxsByScriptPubkey> {
      const [ txs ] = await txsByScriptPubkey.query('', [ scriptHash ])
      return txs ?? {}
    },

    async fetchTransactions(opts: EdgeGetTransactionsOptions): Promise<IProcessorTransaction[]> {
      const {
        startEntries = 10,
        startIndex = 0
      } = opts
      const txData = await txsByDate.queryByCount('', startEntries, startIndex)
      const txPromises = txData.map(async ({ [RANGE_ID_KEY]: txId }) => {
        const [ tx ] = await txById.query('', [ txId ])
        return tx
      })
      return Promise.all(txPromises)
    },

    async saveTransaction(tx: IProcessorTransaction, withQueue = true): Promise<void> {
      const saveTx = () => innerSaveTransaction(tx)
      return withQueue
        ? queue.add(saveTx)
        : saveTx()
    },

    updateTransaction(
      txId: string,
      data: IProcessorTransaction
    ): void {
      queue.add(() => innerUpdateTransaction(txId, data))
    },

    // TODO: delete everything from db?
    dropTransaction(txId: string): void {
      queue.add(() => innerDropTransaction(txId))
    },

    async fetchUtxo(id: string): Promise<IUTXO> {
      const [ utxo ] = await utxoById.query('', [ id ])
      return utxo
    },

    async fetchUtxosByScriptPubkey(scriptPubkey: string): Promise<IUTXO[]> {
      const [ ids = [] ] = await utxoIdsByScriptPubkey.query('', [ scriptPubkey ])
      return ids.length === 0 ? [] : utxoById.query('', ids)
    },

    async fetchAllUtxos(): Promise<IUTXO[]> {
      const result = await utxoIdsBySize.query('', 0, utxoIdsBySize.max(''))
      const ids = result.map(({ [RANGE_ID_KEY]: id }) => id)
      return ids.length === 0 ? [] : utxoById.query('', ids)
    },

    saveUtxo(utxo: IUTXO) {
      queue.add(() => innerSaveUtxo(utxo))
    },

    removeUtxo(utxo: IUTXO) {
      queue.add(() => innerRemoveUtxo(utxo))
    }
  }

  return fns
}
