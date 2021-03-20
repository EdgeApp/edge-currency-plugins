import {
  BaseType,
  clearMemletCache,
  createCountBase,
  createHashBase,
  createRangeBase,
  openBase
} from 'baselet'
import { CountBase } from 'baselet/src/CountBase'
import { HashBase } from 'baselet/src/HashBase'
import { RangeBase } from 'baselet/src/RangeBase'
import * as bs from 'biggystring'
import { Disklet, navigateDisklet } from 'disklet'
import { EdgeGetTransactionsOptions } from 'edge-core-js/lib/types'

import { AddressPath, EmitterEvent } from '../../plugin/types'
import { makeQueue } from './makeQueue'
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
  TxById,
  txByIdConfig,
  txIdsByBlockHeightConfig,
  TxsByDate,
  txsByDateConfig,
  TxsByScriptPubkey,
  txsByScriptPubkeyConfig,
  UtxoById,
  utxoByIdConfig,
  utxoIdsByScriptPubkeyConfig,
  utxoIdsBySizeConfig
} from './Models/baselet'
import {
  Baselet,
  BaseletConfig,
  IAddress,
  IProcessorTransaction,
  IUTXO
} from './types'

const BASELET_DIR = 'tables'

interface ProcessorEmitter {
  emit: (
    event: EmitterEvent.PROCESSOR_TRANSACTION_CHANGED,
    transaction: IProcessorTransaction
  ) => this
}

interface ProcessorConfig {
  disklet: Disklet
  emitter: ProcessorEmitter
}

export interface Processor {
  dumpData: () => Promise<any>

  clearAll: () => Promise<void>

  fetchScriptPubkeyByPath: (path: AddressPath) => Promise<ScriptPubkeyByPath>

  fetchAddressByScriptPubkey: (
    scriptPubkey: string
  ) => Promise<AddressByScriptPubkey>

  hasSPubKey: (scriptPubkey: string) => Promise<boolean>

  fetchAddressesByPath: (
    path: Omit<AddressPath, 'addressIndex'>
  ) => Promise<AddressByScriptPubkey[]>

  getNumAddressesFromPathPartition: (
    path: Omit<AddressPath, 'addressIndex'>
  ) => number

  fetchScriptPubkeysByBalance: () => Promise<ScriptPubkeysByBalance[]>

  saveAddress: (data: IAddress) => Promise<void>

  updateAddressByScriptPubkey: (
    scriptPubkey: string,
    data: Partial<IAddress>
  ) => Promise<void>

  getNumTransactions: () => number

  fetchTxIdsByBlockHeight: (
    blockHeightMin: number,
    blockHeightMax?: number
  ) => Promise<string[]>

  insertTxIdByBlockHeight: (blockHeight: number, data: string) => Promise<void>

  removeTxIdByBlockHeight: (blockHeight: number, txId: string) => Promise<void>

  fetchTransaction: (txId: string) => Promise<TxById>

  fetchTransactionsByScriptPubkey: (
    scriptHash: string
  ) => Promise<TxsByScriptPubkey>

  fetchTransactions: (
    opts: EdgeGetTransactionsOptions
  ) => Promise<IProcessorTransaction[]>

  saveTransaction: (
    tx: IProcessorTransaction,
    withQueue?: boolean
  ) => Promise<void>

  updateTransaction: (
    txId: string,
    data: Pick<IProcessorTransaction, 'blockHeight'>
  ) => void

  dropTransaction: (txId: string) => void

  fetchUtxo: (id: string) => Promise<UtxoById>

  fetchUtxosByScriptPubkey: (scriptPubkey: string) => Promise<IUTXO[]>

  fetchAllUtxos: () => Promise<IUTXO[]>

  saveUtxo: (utxo: IUTXO) => void

  removeUtxo: (utxo: IUTXO) => void
}

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
    if (!err.message.includes('already exists')) {
      throw err
    }
  }
  return await openBase(disklet, config.dbName)
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function makeBaselets(disklet: Disklet) {
  const countBases = await Promise.all([
    createOrOpen(disklet, scriptPubkeyByPathConfig),
    createOrOpen(disklet, addressPathByMRUConfig)
  ])
  const rangeBases = await Promise.all([
    createOrOpen(disklet, scriptPubkeysByBalanceConfig),
    createOrOpen(disklet, txIdsByBlockHeightConfig),
    createOrOpen(disklet, txsByDateConfig),
    createOrOpen(disklet, utxoIdsBySizeConfig)
  ])
  const hashBases = await Promise.all([
    createOrOpen(disklet, addressByScriptPubkeyConfig),
    createOrOpen(disklet, txByIdConfig),
    createOrOpen(disklet, txsByScriptPubkeyConfig),
    createOrOpen(disklet, utxoByIdConfig),
    createOrOpen(disklet, utxoIdsByScriptPubkeyConfig)
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

  const allBases = [...countBases, ...rangeBases, ...hashBases]

  return {
    scriptPubkeyByPath,
    addressPathByMRU,
    scriptPubkeysByBalance,
    txIdsByBlockHeight,
    txsByDate,
    utxoIdsBySize,
    addressByScriptPubkey,
    txById,
    txsByScriptPubkey,
    utxoById,
    utxoIdsByScriptPubkey,
    allBases
  }
}

export async function makeProcessor(
  config: ProcessorConfig
): Promise<Processor> {
  const queue = makeQueue()
  const { emitter } = config
  const disklet = navigateDisklet(config.disklet, BASELET_DIR)
  let baselets = await makeBaselets(disklet)

  async function processAndSaveAddress(data: IAddress) {
    const [addressData] = await baselets.addressByScriptPubkey.query('', [
      data.scriptPubkey
    ])
    if (addressData != null) {
      throw new Error(
        'Address already exists. To update its data call `updateAddressByScriptPubkey`'
      )
    }

    // If there is path info on the address to save but not stored in
    // the previously existing data, save to the by path database.
    if (data.path != null && !addressData?.path) {
      await innerSaveScriptPubkeyByPath(data.scriptPubkey, data.path)
    }

    try {
      await Promise.all([
        baselets.addressByScriptPubkey.insert('', data.scriptPubkey, data),

        baselets.scriptPubkeysByBalance.insert('', {
          [RANGE_ID_KEY]: data.scriptPubkey,
          [RANGE_KEY]: parseInt(data.balance)
        })

        // TODO: change to rangebase
        // addressByMRU.insert('', index, data)
      ])

      await processScriptPubkeyTransactions(data.scriptPubkey)
    } catch (err) {
      // Undo any changes we made on a fail
      await Promise.all([
        baselets.scriptPubkeysByBalance.delete(
          '',
          parseInt(data.balance),
          data.scriptPubkey
        ),

        baselets.addressByScriptPubkey.delete('', [data.scriptPubkey])
      ])
    }
  }

  // Find transactions associated with this scriptPubkey, process the balances and save it
  async function processScriptPubkeyTransactions(
    scriptPubkey: string
  ): Promise<void> {
    const byScriptPubkey = await fns.fetchTransactionsByScriptPubkey(
      scriptPubkey
    )
    for (const txId in byScriptPubkey) {
      const tx = byScriptPubkey[txId]
      const txData = await fns.fetchTransaction(txId)
      if (txData != null) {
        const ourIns = [...txData.ourIns, ...Object.keys(tx.ins)]
        const ourOuts = [...txData.ourOuts, ...Object.keys(tx.outs)]

        await fns.updateAddressByScriptPubkey(scriptPubkey, {
          lastTouched: txData.date,
          used: true
        })

        txData.ourAmount = await calculateTransactionAmount(txData)
        await innerUpdateTransaction(txId, { ourIns, ourOuts })
      }
    }
  }

  async function innerFetchAddressesByScriptPubkeys(
    scriptPubkeys: string[]
  ): Promise<AddressByScriptPubkey[]> {
    if (scriptPubkeys.length === 0) return []
    const addresses: AddressByScriptPubkey[] = await baselets.addressByScriptPubkey.query(
      '',
      scriptPubkeys
    )

    // Update the last query values
    const now = Date.now()
    addresses.map(async address => {
      if (address != null) {
        return await innerUpdateAddressByScriptPubkey(address.scriptPubkey, {
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

    await baselets.txsByScriptPubkey.insert('', scriptPubkey, txs)
  }

  async function calculateTransactionAmount(
    tx: IProcessorTransaction
  ): Promise<string> {
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

  async function innerSaveScriptPubkeyByPath(
    scriptPubkey: string,
    path: AddressPath
  ): Promise<void> {
    await baselets.scriptPubkeyByPath.insert(
      addressPathToPrefix(path),
      path.addressIndex,
      scriptPubkey
    )
  }

  async function innerUpdateAddressByScriptPubkey(
    scriptPubkey: string,
    data: Partial<IAddress>
  ): Promise<IAddress> {
    const [address] = await baselets.addressByScriptPubkey.query('', [
      scriptPubkey
    ])
    if (!address) {
      throw new Error('Cannot update address that does not exist')
    }

    const promises: Array<Promise<any>> = []

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
        baselets.scriptPubkeysByBalance.update('', oldRange, {
          [RANGE_ID_KEY]: address.scriptPubkey,
          [RANGE_KEY]: parseInt(data.balance)
        })
      )
    }

    if (data.path != null && address.path == null) {
      promises.push(innerSaveScriptPubkeyByPath(scriptPubkey, data.path))
    }

    await Promise.all([
      ...promises,
      baselets.addressByScriptPubkey.insert('', address.scriptPubkey, address)
    ])

    return address
  }

  async function innerSaveTransaction(
    tx: IProcessorTransaction
  ): Promise<void> {
    const existingTx = await fns.fetchTransaction(tx.txid)
    if (existingTx == null) {
      await baselets.txsByDate.insert('', {
        [RANGE_ID_KEY]: tx.txid,
        [RANGE_KEY]: tx.date
      })
    }

    for (const inOout of [true, false]) {
      const arr = inOout ? tx.inputs : tx.outputs
      for (let i = 0; i < arr.length; i++) {
        const { scriptPubkey } = arr[i]

        await saveTransactionByScriptPubkey(scriptPubkey, tx, inOout, i)
        const own = await fns.hasSPubKey(scriptPubkey)
        if (own) {
          if (inOout) {
            tx.ourIns.push(i.toString())
          } else {
            tx.ourOuts.push(i.toString())
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
    await baselets.txById.insert('', tx.txid, tx)
  }

  async function innerUpdateTransaction(
    txId: string,
    data: Partial<IProcessorTransaction>
  ) {
    const tx = await fns.fetchTransaction(txId)
    if (tx == null) {
      throw new Error('Cannot update transaction that does not exists')
    }

    if (data.blockHeight) {
      if (tx.blockHeight < data.blockHeight) {
        await fns.removeTxIdByBlockHeight(tx.blockHeight, txId)
        await fns.insertTxIdByBlockHeight(data.blockHeight, txId)
      }
      tx.blockHeight = data.blockHeight
    }
    if (data.ourIns != null) {
      tx.ourIns = data.ourIns
    }
    if (data.ourOuts != null) {
      tx.ourOuts = data.ourOuts
    }
    if (data.ourAmount) {
      tx.ourAmount = data.ourAmount
    }

    emitter.emit(EmitterEvent.PROCESSOR_TRANSACTION_CHANGED, tx)

    await baselets.txById.insert('', txId, tx)
  }

  async function innerDropTransaction(txId: string) {
    const tx = await fns.fetchTransaction(txId)
    if (tx == null) return

    for (let i = 0; i < tx.inputs.length; i++) {
      const input = tx.inputs[i]

      await saveTransactionByScriptPubkey(
        input.scriptPubkey,
        tx,
        true,
        i,
        false
      )
    }

    for (let i = 0; i < tx.outputs.length; i++) {
      const output = tx.outputs[i]

      await saveTransactionByScriptPubkey(
        output.scriptPubkey,
        tx,
        false,
        i,
        false
      )
    }

    await fns.removeTxIdByBlockHeight(tx.blockHeight, tx.txid)

    tx.blockHeight = -1
    await baselets.txById.insert('', tx.txid, tx)

    // TODO: recalculate balances
  }

  async function innerSaveUtxo(utxo: IUTXO) {
    await baselets.utxoById.insert('', utxo.id, utxo)
    await baselets.utxoIdsBySize.insert('', {
      [RANGE_ID_KEY]: utxo.id,
      [RANGE_KEY]: parseInt(utxo.value)
    })

    const [utxoIds] = await baselets.utxoIdsByScriptPubkey.query('', [
      utxo.scriptPubkey
    ])
    const set = new Set(utxoIds)
    set.add(utxo.id)
    await baselets.utxoIdsByScriptPubkey.insert(
      '',
      utxo.scriptPubkey,
      Array.from(set)
    )
  }

  async function innerRemoveUtxo(utxo: IUTXO) {
    await baselets.utxoById.delete('', [utxo.id])
    await baselets.utxoIdsBySize.delete('', parseInt(utxo.value), utxo.id)
    await baselets.utxoIdsByScriptPubkey.delete('', [utxo.scriptPubkey])
  }

  const fns: Processor = {
    async dumpData(): Promise<any> {
      return await Promise.all(
        baselets.allBases.map(async base => ({
          databaseName: base.databaseName,
          data: await base.dumpData('')
        }))
      )
    },

    async clearAll(): Promise<void> {
      await clearMemletCache()
      // why is this delay needed?
      await new Promise(resolve => setTimeout(resolve, 0))
      await await disklet.delete('.')
      baselets = await makeBaselets(disklet)
    },

    async fetchScriptPubkeyByPath(
      path: AddressPath
    ): Promise<ScriptPubkeyByPath> {
      const [scriptPubkey] = await baselets.scriptPubkeyByPath.query(
        addressPathToPrefix(path),
        path.addressIndex
      )
      return scriptPubkey
    },

    async fetchTxIdsByBlockHeight(
      blockHeightMin: number,
      blockHeightMax?: number
    ): Promise<string[]> {
      const result = await baselets.txIdsByBlockHeight.query(
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
      await baselets.txIdsByBlockHeight.insert('', {
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
      await baselets.txIdsByBlockHeight.delete('', blockHeight, txId)
    },

    async fetchAddressByScriptPubkey(
      scriptPubkey: string
    ): Promise<AddressByScriptPubkey> {
      const [address] = await innerFetchAddressesByScriptPubkeys([scriptPubkey])
      return address
    },

    async hasSPubKey(scriptPubkey: string): Promise<boolean> {
      return await fns
        .fetchAddressByScriptPubkey(scriptPubkey)
        .then(address => !(address == null))
    },

    async fetchAddressesByPath(
      path: Omit<AddressPath, 'addressIndex'>
    ): Promise<AddressByScriptPubkey[]> {
      const partition = addressPathToPrefix(path)
      const scriptPubkeys = await baselets.scriptPubkeyByPath.query(
        partition,
        0,
        baselets.scriptPubkeyByPath.length(partition) - 1
      )
      return await innerFetchAddressesByScriptPubkeys(scriptPubkeys)
    },

    getNumAddressesFromPathPartition(
      path: Omit<AddressPath, 'addressIndex'>
    ): number {
      return baselets.scriptPubkeyByPath.length(addressPathToPrefix(path))
    },

    // Returned in lowest first due to RangeBase
    async fetchScriptPubkeysByBalance(): Promise<ScriptPubkeysByBalance[]> {
      const max = baselets.scriptPubkeysByBalance.max('') ?? 0
      return await baselets.scriptPubkeysByBalance.query('', 0, max)
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

    getNumTransactions(): number {
      return baselets.txsByDate.size('')
    },

    async fetchTransaction(txId: string): Promise<TxById> {
      const [data] = await baselets.txById.query('', [txId])
      return data
    },

    async fetchTransactionsByScriptPubkey(
      scriptHash: string
    ): Promise<TxsByScriptPubkey> {
      const [txs] = await baselets.txsByScriptPubkey.query('', [scriptHash])
      return txs ?? {}
    },

    async fetchTransactions(
      opts: EdgeGetTransactionsOptions
    ): Promise<IProcessorTransaction[]> {
      const {
        startEntries,
        startIndex,
        startDate = new Date(0),
        endDate = new Date()
      } = opts

      let txData: TxsByDate = []
      if (startEntries != null && startIndex != null) {
        txData = await baselets.txsByDate.queryByCount(
          '',
          startEntries,
          startIndex
        )
      } else {
        txData = await baselets.txsByDate.query(
          '',
          startDate.getTime(),
          endDate.getTime()
        )
      }

      const txPromises = txData.map(
        async ({ [RANGE_ID_KEY]: txId }) =>
          await baselets.txById.query('', [txId]).then(([tx]) => tx)
      )
      return Promise.all(txPromises)
    },

    async saveTransaction(
      tx: IProcessorTransaction,
      withQueue = true
    ): Promise<void> {
      const saveTx = async () => await innerSaveTransaction(tx)
      return withQueue ? queue.add(saveTx) : await saveTx()
    },

    updateTransaction(
      txId: string,
      data: Pick<IProcessorTransaction, 'blockHeight'>
    ): void {
      queue.add(async () => await innerUpdateTransaction(txId, data))
    },

    // TODO: delete everything from db?
    dropTransaction(txId: string): void {
      queue.add(async () => await innerDropTransaction(txId))
    },

    async fetchUtxo(id: string): Promise<IUTXO> {
      const [utxo] = await baselets.utxoById.query('', [id])
      return utxo
    },

    async fetchUtxosByScriptPubkey(scriptPubkey: string): Promise<IUTXO[]> {
      const [ids = []] = await baselets.utxoIdsByScriptPubkey.query('', [
        scriptPubkey
      ])
      return ids.length === 0 ? [] : await baselets.utxoById.query('', ids)
    },

    async fetchAllUtxos(): Promise<IUTXO[]> {
      const result = await baselets.utxoIdsBySize.query(
        '',
        0,
        baselets.utxoIdsBySize.max('')
      )
      const ids = result.map(({ [RANGE_ID_KEY]: id }) => id)
      return ids.length === 0 ? [] : baselets.utxoById.query('', ids)
    },

    saveUtxo(utxo: IUTXO) {
      queue.add(async () => await innerSaveUtxo(utxo))
    },

    removeUtxo(utxo: IUTXO) {
      queue.add(async () => await innerRemoveUtxo(utxo))
    }
  }

  return fns
}
