import { createCountBase, createHashBase, createRangeBase, openBase, BaseType } from 'baselet'
import { CountBase } from 'baselet/src/CountBase'
import { HashBase } from 'baselet/src/HashBase'
import { RangeBase } from 'baselet/src/RangeBase'
import * as bs from 'biggystring'
import { Disklet } from 'disklet'

import { makePathFromString, Path } from '../../Path'
import { IAddress, IAddressOptional, IAddressPartial, IAddressRequired, IProcessorTransaction, IUTXO } from './types'
import { ProcessorTransaction } from './Models/ProcessorTransaction'
import { makeQueue } from './makeQueue'
import { EmitterEvent } from '../../plugin/types'

interface BaseletConfig<T extends BaseType> {
  dbName: string
  type: T
  bucketSize: number
}
type Baselet = HashBase | CountBase | RangeBase
interface Baselets {
  addressByPath: BaseletConfig<BaseType.CountBase>
  addressPathByScriptPubKey: BaseletConfig<BaseType.HashBase>
  addressByMRU: BaseletConfig<BaseType.CountBase>
  scriptPubKeysByBalance: BaseletConfig<BaseType.RangeBase>
  txById: BaseletConfig<BaseType.HashBase>
  txsByScriptPubKey: BaseletConfig<BaseType.HashBase>
  txsByDate: BaseletConfig<BaseType.RangeBase>
  utxoById: BaseletConfig<BaseType.HashBase>
  utxoIdsByScriptPubKey: BaseletConfig<BaseType.HashBase>
  utxoIdsBySize: BaseletConfig<BaseType.RangeBase>
}
const BASELET_CONFIGS: Baselets = {
  addressByPath: { dbName: 'addressByPath', type: BaseType.CountBase, bucketSize: 50 },
  addressPathByScriptPubKey: { dbName: 'addressPathByScriptPubKey', type: BaseType.HashBase, bucketSize: 6 },
  addressByMRU: { dbName: 'addressByMRU', type: BaseType.CountBase, bucketSize: 100 },
  scriptPubKeysByBalance: { dbName: 'scriptPubKeysByBalance', type: BaseType.RangeBase, bucketSize: 100000 },
  txById: { dbName: 'txById', type: BaseType.HashBase, bucketSize: 2 },
  txsByScriptPubKey: { dbName: 'txsByScriptPubKey', type: BaseType.HashBase, bucketSize: 5 },
  txsByDate: { dbName: 'txsByDate', type: BaseType.RangeBase, bucketSize: 30 * 24 * 60 * 60 * 1000 },
  utxoById: { dbName: 'utxoById', type: BaseType.HashBase, bucketSize: 2 },
  utxoIdsByScriptPubKey: { dbName: 'utxoIdsByScriptPubKey', type: BaseType.HashBase, bucketSize: 6 },
  utxoIdsBySize: { dbName: 'utxoIdsBySize', type: BaseType.RangeBase, bucketSize: 100000 },
}

const RANGE_ID_KEY = 'idKey'
const RANGE_KEY = 'rangeKey'

interface ProcessorEmitter {
  emit(event: EmitterEvent.PROCESSOR_TRANSACTION_CHANGED, transaction: ProcessorTransaction): this
}

interface ProcessorConfig {
  disklet: Disklet
  emitter: ProcessorEmitter,
}

export interface Processor {
  fetchAddress(path: Path): Promise<IAddress | null>

  fetchAddressPathBySPubKey(scriptPubKey: string): Promise<string | null>

  hasSPubKey(scriptPubKey: string): Promise<boolean>

  fetchAddressesByPath(path: Path): Promise<IAddress[]>

  fetchAddressCountFromPathPartition(path: Path): number

  fetchScriptPubKeysByBalance(): Promise<Array<{ [RANGE_ID_KEY]: string; [RANGE_KEY]: string }>>

  saveAddress(path: Path, data: IAddressRequired & IAddressOptional, onComplete?: () => void): void

  updateAddress(path: Path, data: Partial<IAddress>): void

  updateAddressByScriptPubKey(scriptPubKey: string, data: Partial<IAddress>): void

  fetchTransaction(txId: string): Promise<ProcessorTransaction | null>

  fetchTransactionsByScriptPubKey(scriptHash: string): Promise<string[]>

  fetchTransactionsByDate(start: number, end?: number): Promise<ProcessorTransaction[]>

  saveTransaction(tx: ProcessorTransaction): void

  updateTransaction(txId: string, data: Pick<IProcessorTransaction, 'blockHeight'>): void

  dropTransaction(txId: string): void

  fetchBalance(path?: Path): Promise<string>

  fetchUtxo(id: string): Promise<IUTXO>

  fetchUtxos(scriptPubKey?: string): Promise<IUTXO[]>

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
    addressByMRU,
    scriptPubKeysByBalance,
    txById,
    txsByScriptPubKey,
    txsByDate,
    utxoById,
    utxoIdsByScriptPubKey,
    utxoIdsBySize
  ] = await Promise.all([
    createOrOpen(disklet, BASELET_CONFIGS.addressByPath),
    createOrOpen(disklet, BASELET_CONFIGS.addressPathByScriptPubKey),
    createOrOpen(disklet, BASELET_CONFIGS.addressByMRU),
    createOrOpen(disklet, BASELET_CONFIGS.scriptPubKeysByBalance),
    createOrOpen(disklet, BASELET_CONFIGS.txById),
    createOrOpen(disklet, BASELET_CONFIGS.txsByScriptPubKey),
    createOrOpen(disklet, BASELET_CONFIGS.txsByDate),
    createOrOpen(disklet, BASELET_CONFIGS.utxoById),
    createOrOpen(disklet, BASELET_CONFIGS.utxoIdsByScriptPubKey),
    createOrOpen(disklet, BASELET_CONFIGS.utxoIdsBySize)
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
      const txIds = await fns.fetchTransactionsByScriptPubKey(data.scriptPubKey)
      for (const txId of txIds) {
        const txData = await fns.fetchTransaction(txId)
        if (txData) {
          await processTransaction(txData)
          await txById.insert('', txData.txid, txData)
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

  async function innerFetchAddress(path: Path): Promise<IAddress | null> {
    const prefix = path.toChange(true)
    const [ data ] = await addressByPath.query(prefix, path.index)
    return data
  }

  async function fetchAddressesByPrefix(prefix: string, startIndex = 0, endIndex?: number): Promise<IAddress[]> {
    const end = endIndex ?? addressByPath.length(prefix) - 1
    return addressByPath.query(prefix, startIndex, end)
  }

  async function processTransaction(tx: ProcessorTransaction): Promise<ProcessorTransaction> {
    for (const inOout of [ true, false ]) {
      const arr = inOout ? tx.inputs : tx.outputs
      for (let i = 0; i < arr.length; i++) {
        const { scriptPubKey } = arr[i]

        await saveTransactionByScriptPubKey(scriptPubKey, tx.txid)

        const own = await fns.hasSPubKey(scriptPubKey)
        if (own) {
          const arr = inOout ? tx.ourIns : tx.ourOuts
          const set = new Set(arr)
          if (!set.has(i)) {
            set.add(i)
            if (inOout) {
              tx.ourIns = Array.from(set)
            } else {
              tx.ourOuts = Array.from(set)
            }

            const amount = inOout ? tx.inputs[i].amount : tx.outputs[i].amount
            tx.ourAmount = inOout
              ? bs.sub(tx.ourAmount, amount)
              : bs.add(tx.ourAmount, amount)
              tx.ourOuts = Array.from(set)

            emitter.emit(EmitterEvent.PROCESSOR_TRANSACTION_CHANGED, tx)
          }

          await fns.updateAddressByScriptPubKey(scriptPubKey, {
            lastTouched: tx.date,
            used: true
          })
        }
      }
    }

    await txById.insert('', tx.txid, tx)

    return tx
  }

  async function saveTransactionByScriptPubKey(
    scriptPubKey: string,
    txId: string,
    save = true
  ) {
    const txIds = await fns.fetchTransactionsByScriptPubKey(scriptPubKey)
    const set = new Set(txIds)
    save ? set.add(txId) : set.delete(txId)
    await txsByScriptPubKey.insert('', scriptPubKey, Array.from(set))
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
    if (pathStr) {
      const path = makePathFromString(pathStr)
      await innerUpdateAddress(path, data)
    }
  }

  async function innerSaveTransaction(tx: ProcessorTransaction): Promise<void> {
    // Don't save the same transaction twice. Possible data overwrite
    const existingTx = await fns.fetchTransaction(tx.txid)
    if (!existingTx) {
      await txsByDate.insert('', {
        [RANGE_ID_KEY]: tx.txid,
        [RANGE_KEY]: tx.date
      })
    }

    await processTransaction(tx)
  }

  async function innerUpdateTransaction(
    txId: string,
    data: Pick<IProcessorTransaction, 'blockHeight'>
  ) {
    const txData = await fns.fetchTransaction(txId)
    if (!txData) return

    if (data.blockHeight != null) {
      txData.blockHeight = data.blockHeight
    }

    await txById.insert('', txId, txData)
  }

  async function innerDropTransaction(txId: string) {
    const tx = await fns.fetchTransaction(txId)
    if (!tx) return

    for (let i = 0; i < tx.inputs.length; i++) {
      const input = tx.inputs[i]

      await saveTransactionByScriptPubKey(input.scriptPubKey, txId, false)
    }

    for (let i = 0; i < tx.outputs.length; i++) {
      const output = tx.outputs[i]

      await saveTransactionByScriptPubKey(output.scriptPubKey, txId, false)
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
    async fetchAddress(path: Path): Promise<IAddress | null> {
      const lastQuery = Date.now()
      const address = await innerFetchAddress(path)
      address && await innerUpdateAddress(path, { lastQuery })
      return address
    },

    async fetchAddressPathBySPubKey(
      scriptPubKey: string
    ): Promise<string | null> {
      const [ path ] = await addressPathByScriptPubKey.query('', [ scriptPubKey ])
      return path
    },

    async hasSPubKey(scriptPubKey: string): Promise<boolean> {
      return fns.fetchAddressPathBySPubKey(scriptPubKey).then(
        (sPubKey) => !!sPubKey
      )
    },

    async fetchAddressesByPath(path: Path): Promise<IAddress[]> {
      const prefix = path.toChange(true)
      const addresses = await fetchAddressesByPrefix(prefix)

      // TODO: queueify
      const now = Date.now()
      for (const address of addresses) {
        const path = makePathFromString(address.path)
        await innerUpdateAddress(path, {
          ...address,
          lastQuery: now
        })
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
    ): Promise<string[]> {
      const [ txIds ] = await txsByScriptPubKey.query('', [ scriptHash ])
      return txIds ?? []
    },

    async fetchTransactionsByDate(
      start: number,
      end?: number
    ): Promise<ProcessorTransaction[]> {
      const txs = await txsByDate.query('', start, end)
      return txs.map((tx) => new ProcessorTransaction(tx))
    },

    saveTransaction(tx: ProcessorTransaction): void {
      queue.add(() => innerSaveTransaction(tx))
    },

    updateTransaction(
      txId: string,
      data: Pick<IProcessorTransaction, 'blockHeight'>
    ): void {
      queue.add(() => innerUpdateTransaction(txId, data))
    },

    // TODO: delete everything from db?
    dropTransaction(txId: string): void {
      queue.add(() => innerDropTransaction(txId))
    },

    async fetchBalance(path?: Path): Promise<string> {
      let balance: string
      if (path) {
        const address = await innerFetchAddress(path)
        balance = address?.balance ?? '0'
      } else {
        const result = await utxoIdsBySize.query('', 0, utxoIdsBySize.max(''))
        balance = result.reduce(
          (sum: string, { [RANGE_KEY]: range }: { [RANGE_KEY]: string }) => bs.add(sum, range.toString()),
          '0'
        )
      }

      return balance
    },

    async fetchUtxo(id: string): Promise<IUTXO> {
      const [ utxo ] = await utxoById.query('', [ id ])
      return utxo
    },

    async fetchUtxos(scriptPubKey?: string): Promise<IUTXO[]> {
      let ids: string[] = []
      if (scriptPubKey) {
        const [ result = [] ] = await utxoIdsByScriptPubKey.query('', [ scriptPubKey ])
        ids = result
      } else {
        const result = await utxoIdsBySize.query('', 0, utxoIdsBySize.max(''))
        ids = result.map(({ [RANGE_ID_KEY]: id }) => id)
      }

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
