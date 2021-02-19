import { BaseType, createCountBase, createHashBase, createRangeBase, openBase } from 'baselet'
import { CountBase } from 'baselet/src/CountBase'
import { HashBase } from 'baselet/src/HashBase'
import { RangeBase } from 'baselet/src/RangeBase'
import * as bs from 'biggystring'
import { Disklet } from 'disklet'

import { Baselet, BaseletConfig, IAddress, IProcessorTransaction, IUTXO } from './types'
import { ProcessorTransaction } from './Models/ProcessorTransaction'
import { makeQueue } from './makeQueue'
import { AddressPath, EmitterEvent } from '../../plugin/types'
import {
  AddressByScriptPubKey,
  addressByScriptPubKeyConfig,
  addressPathByMRUConfig,
  addressPathToPrefix,
  RANGE_ID_KEY,
  RANGE_KEY,
  ScriptPubKeyByPath,
  scriptPubKeyByPathConfig,
  ScriptPubKeysByBalance,
  scriptPubKeysByBalanceConfig,
  TxById,
  txByIdConfig,
  txsByDateConfig,
  TxsByScriptPubKey,
  txsByScriptPubKeyConfig,
  UtxoById,
  utxoByIdConfig,
  utxoIdsByScriptPubKeyConfig,
  utxoIdsBySizeConfig
} from './Models/baselet'
import { EdgeGetTransactionsOptions } from 'edge-core-js/lib/types'

interface ProcessorEmitter {
  emit(event: EmitterEvent.PROCESSOR_TRANSACTION_CHANGED, transaction: ProcessorTransaction): this
}

interface ProcessorConfig {
  disklet: Disklet
  emitter: ProcessorEmitter,
}

export interface Processor {
  fetchScriptPubKeyByPath(path: AddressPath): Promise<ScriptPubKeyByPath>

  fetchAddressByScriptPubKey(scriptPubKey: string): Promise<AddressByScriptPubKey>

  hasSPubKey(scriptPubKey: string): Promise<boolean>

  fetchAddressesByPath(path: Omit<AddressPath, 'addressIndex'>): Promise<AddressByScriptPubKey[]>

  fetchAddressCountFromPathPartition(path: Omit<AddressPath, 'addressIndex'>): number

  fetchScriptPubKeysByBalance(): Promise<ScriptPubKeysByBalance[]>

  saveAddress(data: IAddress, onComplete?: () => void): void

  updateAddressByScriptPubKey(scriptPubKey: string, data: Partial<IAddress>): void

  fetchTransaction(txId: string): Promise<TxById>

  fetchTransactionsByScriptPubKey(scriptHash: string): Promise<TxsByScriptPubKey>

  fetchTransactions(opts: EdgeGetTransactionsOptions): Promise<ProcessorTransaction[]>

  saveTransaction(tx: ProcessorTransaction, withQueue?: boolean): Promise<void>

  updateTransaction(txId: string, data: Pick<IProcessorTransaction, 'blockHeight'>): void

  dropTransaction(txId: string): void

  fetchUtxo(id: string): Promise<UtxoById>

  fetchUtxosByScriptPubKey(scriptPubKey: string): Promise<IUTXO[]>

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

  const [
    scriptPubKeyByPath,
    addressByScriptPubKey,
    addressPathByMRU,
    scriptPubKeysByBalance,
    txById,
    txsByScriptPubKey,
    txsByDate,
    utxoById,
    utxoIdsByScriptPubKey,
    utxoIdsBySize
  ] = await Promise.all([
    createOrOpen(disklet, scriptPubKeyByPathConfig),
    createOrOpen(disklet, addressByScriptPubKeyConfig),
    createOrOpen(disklet, addressPathByMRUConfig),
    createOrOpen(disklet, scriptPubKeysByBalanceConfig),
    createOrOpen(disklet, txByIdConfig),
    createOrOpen(disklet, txsByScriptPubKeyConfig),
    createOrOpen(disklet, txsByDateConfig),
    createOrOpen(disklet, utxoByIdConfig),
    createOrOpen(disklet, utxoIdsByScriptPubKeyConfig),
    createOrOpen(disklet, utxoIdsBySizeConfig)
  ])

  async function processAndSaveAddress(data: IAddress) {
    const [ addressData ] = await addressByScriptPubKey.query('', [ data.scriptPubKey ])
    if (addressData != null) {
      throw new Error('Address already exists. To update its data call `updateAddressByScriptPubKey`')
    }

    // If there is path info on the address to save but not stored in
    // the previously existing data, save to the by path database.
    if (data.path && !addressData?.path) {
      await innerSaveScriptPubKeyByPath(data.scriptPubKey, data.path)
    }

    try {
      await Promise.all([
        addressByScriptPubKey.insert(
          '',
          data.scriptPubKey,
          data
        ),

        scriptPubKeysByBalance.insert('', {
          [RANGE_ID_KEY]: data.scriptPubKey,
          [RANGE_KEY]: parseInt(data.balance)
        }),

        // TODO: change to rangebase
        // addressByMRU.insert('', index, data)
      ])

      await processScriptPubKeyTransactions(data.scriptPubKey)
    } catch (err) {
      // Undo any changes we made on a fail
      await Promise.all([
        scriptPubKeysByBalance.delete('', parseInt(data.balance), data.scriptPubKey),

        addressByScriptPubKey.delete('', [ data.scriptPubKey ]),

        // TODO:
        // addressByMRU.delete()
      ])
    }
  }

  // Find transactions associated with this scriptPubKey, process the balances and save it
  async function processScriptPubKeyTransactions(scriptPubKey: string): Promise<void> {
    const byScriptPubKey = await fns.fetchTransactionsByScriptPubKey(scriptPubKey)
    for (const txId in byScriptPubKey) {
      const tx = byScriptPubKey[txId]
      const txData = await fns.fetchTransaction(txId)
      if (txData) {
        txData.ourIns = Object.keys(tx.ins)
        txData.ourOuts = Object.keys(tx.outs)

        await fns.updateAddressByScriptPubKey(scriptPubKey, {
          lastTouched: txData.date,
          used: true
        })

        await innerUpdateTransaction(txId, txData, true)
        queue.add(() => calculateTransactionAmount(txId))
      }
    }
  }

  async function innerFetchAddressesByScriptPubKeys(scriptPubKeys: string[]): Promise<AddressByScriptPubKey[]> {
    if (scriptPubKeys.length === 0) return []
    const addresses: AddressByScriptPubKey[] = await addressByScriptPubKey.query('', scriptPubKeys)

    // Update the last query values
    const now = Date.now()
    addresses.map(async (address) => {
      if (address) {
        return innerUpdateAddressByScriptPubKey(address.scriptPubKey, {
          lastQuery: now
        })
      }
    })

    return addresses
  }

  async function saveTransactionByScriptPubKey(
    scriptPubKey: string,
    tx: ProcessorTransaction,
    isInput: boolean,
    index: number,
    save = true
  ) {
    const txs = await fns.fetchTransactionsByScriptPubKey(scriptPubKey)
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

    await txsByScriptPubKey.insert('', scriptPubKey, txs)

    return txs
  }

  async function calculateTransactionAmount(txId: string) {
    const tx = await fns.fetchTransaction(txId)
    if (!tx) {
      throw new Error(`Cannot calculate amount for non-existent transaction: ${txId}`)
    }

    let total = '0'
    for (const i of tx.ourIns) {
      const { amount } = tx.inputs[parseInt(i)]
      total = bs.sub(total, amount)
    }
    for (const i of tx.ourOuts) {
      const { amount } = tx.outputs[parseInt(i)]
      total = bs.add(total, amount)
    }
    tx.ourAmount = total

    await innerUpdateTransaction(tx.txid, tx, true)
  }

  async function innerSaveScriptPubKeyByPath(scriptPubKey: string, path: AddressPath): Promise<void> {
    await scriptPubKeyByPath.insert(
      addressPathToPrefix(path),
      path.addressIndex,
      scriptPubKey
    )
  }

  async function innerUpdateAddressByScriptPubKey(scriptPubKey: string, data: Partial<IAddress>): Promise<IAddress> {
    const [ address ] = await addressByScriptPubKey.query('', [ scriptPubKey ])
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
        scriptPubKeysByBalance.update('', oldRange, {
          [RANGE_ID_KEY]: address.scriptPubKey,
          [RANGE_KEY]: parseInt(data.balance)
        })
      )
    }

    if (data.path != null && address.path == null) {
      promises.push(
        innerSaveScriptPubKeyByPath(scriptPubKey, data.path)
      )
    }

    await Promise.all([
      ...promises,
      addressByScriptPubKey.insert('', address.scriptPubKey, address)
    ])

    return address
  }

  async function innerSaveTransaction(tx: ProcessorTransaction): Promise<void> {
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
        const { scriptPubKey, amount } = arr[i]

        const txs = await saveTransactionByScriptPubKey(scriptPubKey, tx, inOout, i)
        const own = await fns.hasSPubKey(scriptPubKey)
        if (own) {
          if (inOout) {
            tx.ourIns = Object.keys(txs[tx.txid].ins)
          } else {
            tx.ourOuts = Object.keys(txs[tx.txid].outs)
          }

          await innerUpdateAddressByScriptPubKey(scriptPubKey, {
            lastTouched: tx.date,
            used: true
          })
        }
      }
    }

    await txById.insert('', tx.txid, tx)
    queue.add(() => calculateTransactionAmount(tx.txid))
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
      txData = new ProcessorTransaction(data)
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

      await saveTransactionByScriptPubKey(input.scriptPubKey, tx, true, i, false)
    }

    for (let i = 0; i < tx.outputs.length; i++) {
      const output = tx.outputs[i]

      await saveTransactionByScriptPubKey(output.scriptPubKey, tx, false, i, false)
    }

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

    const [ utxoIds ] = await utxoIdsByScriptPubKey.query('', [ utxo.scriptPubKey ])
    const set = new Set(utxoIds)
    set.add(utxo.id)
    await utxoIdsByScriptPubKey.insert('', utxo.scriptPubKey, Array.from(set))
  }

  async function innerRemoveUtxo(utxo: IUTXO) {
    await utxoById.delete('', [ utxo.id ])
    await utxoIdsBySize.delete('', parseInt(utxo.value), utxo.id)
    await utxoIdsByScriptPubKey.delete('', [ utxo.scriptPubKey ])
  }

  const fns: Processor = {
    async fetchScriptPubKeyByPath(path: AddressPath): Promise<ScriptPubKeyByPath> {
      const [ scriptPubKey ] = await scriptPubKeyByPath.query(
        addressPathToPrefix(path),
        path.addressIndex
      )
      return scriptPubKey
    },

    async fetchAddressByScriptPubKey(scriptPubKey: string): Promise<AddressByScriptPubKey> {
      const [ address ] = await innerFetchAddressesByScriptPubKeys([ scriptPubKey ])
      return address
    },

    async hasSPubKey(scriptPubKey: string): Promise<boolean> {
      return fns.fetchAddressByScriptPubKey(scriptPubKey).then(
        (address) => !!address
      )
    },

    async fetchAddressesByPath(path: Omit<AddressPath, 'addressIndex'>): Promise<AddressByScriptPubKey[]> {
      const scriptPubKeys = await scriptPubKeyByPath.query(addressPathToPrefix(path), 0)
      return innerFetchAddressesByScriptPubKeys(scriptPubKeys)
    },

    fetchAddressCountFromPathPartition(path: Omit<AddressPath, 'addressIndex'>): number {
      return scriptPubKeyByPath.length(addressPathToPrefix(path))
    },

    // Returned in lowest first due to RangeBase
    async fetchScriptPubKeysByBalance(): Promise<ScriptPubKeysByBalance[]> {
      const max = scriptPubKeysByBalance.max('') ?? 0
      return scriptPubKeysByBalance.query('', 0, max)
    },

    saveAddress(
      data: IAddress,
      onComplete?: () => void
    ): void {
      queue.add(async () => {
        await processAndSaveAddress(data)
        onComplete?.()
      })
    },

    updateAddressByScriptPubKey(
      scriptPubKey: string,
      data: Partial<IAddress>
    ): void {
      queue.add(() => innerUpdateAddressByScriptPubKey(scriptPubKey, data))
    },

    async fetchTransaction(txId: string): Promise<TxById> {
      const [ data ] = await txById.query('', [ txId ])
      return data ? new ProcessorTransaction(data) : undefined
    },

    async fetchTransactionsByScriptPubKey(
      scriptHash: string
    ): Promise<TxsByScriptPubKey> {
      const [ txs ] = await txsByScriptPubKey.query('', [ scriptHash ])
      return txs ?? {}
    },

    async fetchTransactions(opts: EdgeGetTransactionsOptions): Promise<ProcessorTransaction[]> {
      const {
        startEntries = 10,
        startIndex = 0
      } = opts
      const txData = await txsByDate.queryByCount('', startEntries, startIndex)
      const txPromises = txData.map(({ [RANGE_ID_KEY]: txId }) =>
        txById.query('', [ txId ])
          .then(([ tx ]) => new ProcessorTransaction(tx))
      )
      return Promise.all(txPromises)
    },

    async saveTransaction(tx: ProcessorTransaction, withQueue = true): Promise<void> {
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

    async fetchUtxosByScriptPubKey(scriptPubKey: string): Promise<IUTXO[]> {
      const [ ids = [] ] = await utxoIdsByScriptPubKey.query('', [ scriptPubKey ])
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
