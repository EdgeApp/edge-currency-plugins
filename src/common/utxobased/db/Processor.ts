import { createCountBase, createHashBase, createRangeBase, openBase, BaseType } from 'baselet'
import { CountBase } from 'baselet/src/CountBase'
import { HashBase } from 'baselet/src/HashBase'
import { RangeBase } from 'baselet/src/RangeBase'
import * as bs from 'biggystring'
import { Disklet } from 'disklet'

import { makePathFromString, Path } from '../../Path'
import {
  Baselet,
  BaseletConfig,
  IAddress,
  IAddressOptional,
  IAddressPartial,
  IAddressRequired,
  IProcessorTransaction,
  IUTXO
} from './types'
import { ProcessorTransaction } from './Models/ProcessorTransaction'
import { makeQueue } from './makeQueue'
import { EmitterEvent } from '../../plugin/types'
import {
  AddressByPath,
  addressByPathConfig,
  addressPathByMRUConfig, AddressPathByScriptPubKey,
  addressPathByScriptPubKeyConfig,
  RANGE_ID_KEY,
  RANGE_KEY, ScriptPubKeysByBalance,
  scriptPubKeysByBalanceConfig, TxById,
  txByIdConfig,
  txsByDateConfig, TxsByScriptPubKey,
  txsByScriptPubKeyConfig, UtxoById,
  utxoByIdConfig,
  utxoIdsByScriptPubKeyConfig, utxoIdsBySizeConfig
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
  fetchAddress(path: Path): Promise<AddressByPath>

  fetchAddressPathBySPubKey(scriptPubKey: string): Promise<AddressPathByScriptPubKey>

  hasSPubKey(scriptPubKey: string): Promise<boolean>

  fetchAddressesByPath(path: Path): Promise<AddressByPath[]>

  fetchAddressCountFromPathPartition(path: Path): number

  fetchScriptPubKeysByBalance(): Promise<Array<ScriptPubKeysByBalance>>

  saveAddress(path: Path, data: IAddressRequired & IAddressOptional, onComplete?: () => void): void

  updateAddress(path: Path, data: Partial<IAddress>): void

  updateAddressByScriptPubKey(scriptPubKey: string, data: Partial<IAddress>): void

  fetchTransaction(txId: string): Promise<TxById>

  fetchTransactionsByScriptPubKey(scriptHash: string): Promise<TxsByScriptPubKey>

  fetchTransactions(opts: EdgeGetTransactionsOptions): Promise<ProcessorTransaction[]>

  saveTransaction(tx: ProcessorTransaction): void

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
    addressByPath,
    addressPathByScriptPubKey,
    addressPathByMRU,
    scriptPubKeysByBalance,
    txById,
    txsByScriptPubKey,
    txsByDate,
    utxoById,
    utxoIdsByScriptPubKey,
    utxoIdsBySize
  ] = await Promise.all([
    createOrOpen(disklet, addressByPathConfig),
    createOrOpen(disklet, addressPathByScriptPubKeyConfig),
    createOrOpen(disklet, addressPathByMRUConfig),
    createOrOpen(disklet, scriptPubKeysByBalanceConfig),
    createOrOpen(disklet, txByIdConfig),
    createOrOpen(disklet, txsByScriptPubKeyConfig),
    createOrOpen(disklet, txsByDateConfig),
    createOrOpen(disklet, utxoByIdConfig),
    createOrOpen(disklet, utxoIdsByScriptPubKeyConfig),
    createOrOpen(disklet, utxoIdsBySizeConfig)
  ])

  async function processAndSaveAddress(path: Path, data: IAddress) {
    const prefix = path.toChange(true)

    try {
      await Promise.all([
        addressByPath.insert(prefix, path.index, data),

        scriptPubKeysByBalance.insert('', {
          [RANGE_ID_KEY]: data.scriptPubKey,
          [RANGE_KEY]: parseInt(data.balance)
        }),

        addressPathByScriptPubKey.insert(
          '',
          data.scriptPubKey,
          path.toString(true)
        ),

        // TODO: change to rangebase
        // addressByMRU.insert('', index, data)
      ])

      // Find transactions associated with this scriptPubKey, process the balances and save it
      const byScriptPubKey = await fns.fetchTransactionsByScriptPubKey(data.scriptPubKey)
      for (const txId in byScriptPubKey) {
        const tx = byScriptPubKey[txId]
        const txData = await fns.fetchTransaction(txId)
        if (txData) {
          txData.ourIns = Object.keys(tx.ins)
          txData.ourOuts = Object.keys(tx.outs)

          await fns.updateAddressByScriptPubKey(data.scriptPubKey, {
            lastTouched: txData.date,
            used: true
          })

          await innerUpdateTransaction(txId, txData, true)
          queue.add(() => calculateTransactionAmount(txId))
        }
      }
    } catch (err) {
      // Undo any changes we made on a fail
      // Note: cannot remove from addressByPath (CountBase)
      await Promise.all([
        scriptPubKeysByBalance.delete('', parseInt(data.balance), data.scriptPubKey),

        addressPathByScriptPubKey.delete('', [data.scriptPubKey]),

        // TODO:
        // addressByMRU.delete()
      ])
    }
  }

  async function innerFetchAddress(path: Path): Promise<AddressByPath> {
    const prefix = path.toChange(true)
    const [ data ] = await addressByPath.query(prefix, path.index)
    return data
  }

  async function fetchAddressesByPrefix(pathPrefix: string, startIndex = 0, endIndex?: number): Promise<AddressByPath[]> {
    const end = endIndex ?? addressByPath.length(pathPrefix) - 1
    return addressByPath.query(pathPrefix, startIndex, end)
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

  async function calculateTransactionAmount(txId: string){
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

  async function innerSaveAddress(
    path: Path,
    data: IAddressPartial
  ) {
    const values: IAddress = {
      lastQuery: 0,
      lastTouched: 0,
      used: false,
      balance: '0',
      ...data,
    }

    await processAndSaveAddress(path, values)
  }

  async function innerUpdateAddress(path: Path, data: Partial<IAddress>): Promise<IAddress> {
    const address = await innerFetchAddress(path)
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

    const prefix = path.toChange(true)
    await Promise.all([
      ...promises,
      addressByPath.insert(prefix, path.index, address),
    ])

    return address
  }

  async function innerUpdateAddressByScriptPubKey(
    scriptPubKey: string,
    data: Partial<IAddress>
  ) {
    const pathStr = await fns.fetchAddressPathBySPubKey(scriptPubKey)
    if (!pathStr) {
      throw new Error(`Cannot update address by scriptPubKey that does not exist: ${scriptPubKey}`)
    }

    const path = makePathFromString(pathStr)
    await innerUpdateAddress(path, data)
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

          await fns.updateAddressByScriptPubKey(scriptPubKey, {
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
    async fetchAddress(path: Path): Promise<AddressByPath> {
      const lastQuery = Date.now()
      const address = await innerFetchAddress(path)
      address && await innerUpdateAddress(path, { lastQuery })
      return address
    },

    async fetchAddressPathBySPubKey(
      scriptPubKey: string
    ): Promise<AddressPathByScriptPubKey> {
      const [ path ] = await addressPathByScriptPubKey.query('', [ scriptPubKey ])
      return path
    },

    async hasSPubKey(scriptPubKey: string): Promise<boolean> {
      return fns.fetchAddressPathBySPubKey(scriptPubKey).then(
        (sPubKey) => !!sPubKey
      )
    },

    async fetchAddressesByPath(path: Path): Promise<AddressByPath[]> {
      const prefix = path.toChange(true)
      const addresses = await fetchAddressesByPrefix(prefix)

      const now = Date.now()
      for (const address of addresses) {
        if (address) {
          const path = makePathFromString(address.path)
          queue.add(() => innerUpdateAddress(path, { ...address, lastQuery: now }))
        }
      }

      return addresses
    },

    fetchAddressCountFromPathPartition(path: Path): number {
      const prefix = path.toChange(true)
      return addressByPath.length(prefix)
    },

    // Returned in lowest first due to RangeBase
    async fetchScriptPubKeysByBalance(): Promise<Array<{ [RANGE_ID_KEY]: string; [RANGE_KEY]: string }>> {
      const max = scriptPubKeysByBalance.max('') ?? 0
      return scriptPubKeysByBalance.query('', 0, max)
    },

    saveAddress(
      path: Path,
      data: IAddressPartial,
      onComplete?: () => void
    ): void {
      queue.add(async () => {
        await innerSaveAddress(path, data)
        onComplete?.()
      })
    },

    updateAddress(
      path: Path,
      data: Partial<IAddress>,
      onComplete?: () => void
    ): void {
      queue.add(async () => {
        await innerUpdateAddress(path, data)
        onComplete?.()
      })
    },

    updateAddressByScriptPubKey(
      scriptPubKey: string,
      data: Partial<IAddress>
    ): void {
      queue.add(() => innerUpdateAddressByScriptPubKey(scriptPubKey, data))
    },

    async fetchTransaction(txId: string): Promise<ProcessorTransaction | null> {
      const [ data ] = await txById.query('', [ txId ])
      return data ? new ProcessorTransaction(data) : null
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

    saveTransaction(tx: ProcessorTransaction): void {
      queue.add(() => innerSaveTransaction(tx))
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
