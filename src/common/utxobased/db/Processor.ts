import { createCountBase, createHashBase, createRangeBase, openBase } from 'baselet'
import { CountBase } from 'baselet/src/CountBase'
import { HashBase } from 'baselet/src/HashBase'
import { RangeBase } from 'baselet/src/RangeBase'
import * as bs from 'biggystring'
import { Disklet } from 'disklet'

import { makePathFromString, Path } from '../../Path'
import { IAddress, IAddressOptional, IAddressPartial, IAddressRequired, IUTXO, IProcessorTransaction } from './types'
import { ProcessorTransaction } from './Models/ProcessorTransaction'

const BUCKET_SIZES = {
  ADDRESS_BY_PATH: 50, // count base
  ADDRESS_PATH_BY_SPUBKEY: 6, // hash base
  ADDRESS_BY_MRU: 100, // count base
  SCRIPT_PUB_KEY_BY_BALANCE: 100000, // range base
  TX_BY_ID: 2, // hash base
  TXS_BY_SPUBKEY: 2, // hash base
  TXS_BY_DATE: 30 * 24 * 60 * 60 * 1000, // range base
  UTXO_BY_ID: 2, // hash base
  UTXO_IDS_BY_SPUBKEY: 6, // hash base
  UTXO_IDS_BY_SIZE: 100000 // range base
}

const RANGE_ID_KEY = 'idKey'
const RANGE_KEY = 'rangeKey'

export interface Processor {
  fetchAddress(path: Path): Promise<IAddress | null>

  fetchAddressPathBySPubKey(scriptPubKey: string): Promise<string | null>

  hasSPubKey(scriptPubKey: string): Promise<boolean>

  fetchAddressesByPath(path: Path): Promise<IAddress[]>

  fetchAddressCountFromPathPartition(path: Path): number

  fetchScriptPubKeysByBalance(): Promise<Array<{ [RANGE_ID_KEY]: string; [RANGE_KEY]: string }>>

  saveAddress(path: Path, data: IAddressRequired & IAddressOptional): Promise<void>

  updateAddress(path: Path, data: Partial<IAddress>): Promise<IAddress>

  updateAddressByScriptPubKey(scriptPubKey: string, data: Partial<IAddress>): Promise<void>

  fetchTransaction(txId: string): Promise<ProcessorTransaction | null>

  fetchTransactionsByScriptPubKey(scriptHash: string): Promise<string[]>

  saveTransaction(tx: ProcessorTransaction): Promise<ProcessorTransaction>

  updateTransaction(txId: string, data: Pick<IProcessorTransaction, 'blockHeight'>): Promise<void>

  dropTransaction(txId: string): Promise<void>

  fetchBalance(path?: Path): Promise<string>

  fetchUtxo(id: string): Promise<IUTXO>

  fetchUtxos(scriptPubKey?: string): Promise<IUTXO[]>

  saveUtxo(utxo: IUTXO): Promise<void>

  removeUtxo(utxo: IUTXO): Promise<void>
}

async function createOrOpen(
  disklet: Disklet,
  type: 'hash' | 'count' | 'range',
  dbName: string,
  size: number
): Promise<any> {
  try {
    switch (type) {
      case 'hash':
        return await createHashBase(disklet, dbName, size)
      case 'count':
        return await createCountBase(disklet, dbName, size)
      case 'range':
        return await createRangeBase(disklet, dbName, size, RANGE_KEY, RANGE_ID_KEY)
    }
  } catch (err) {
    // TODO verify type
    const base = await openBase(disklet, dbName)
    return base
  }
}

export async function makeProcessor(disklet: Disklet): Promise<Processor> {
  const addressByPath: CountBase = await createOrOpen(disklet, 'count', 'addressByPath', BUCKET_SIZES.ADDRESS_BY_PATH)
  const addressPathBySPubKey: HashBase = await createOrOpen(disklet, 'hash', 'addressPathBySPubKey', BUCKET_SIZES.ADDRESS_PATH_BY_SPUBKEY)
  const addressByMRU: CountBase = await createOrOpen(disklet, 'count', 'addressByMRU', BUCKET_SIZES.ADDRESS_BY_MRU)
  const scriptPubKeysByBalance: RangeBase = await createOrOpen(disklet, 'range', 'scriptPubKeysByBalance', BUCKET_SIZES.SCRIPT_PUB_KEY_BY_BALANCE)
  const txById: HashBase = await createOrOpen(disklet, 'hash', 'txById', BUCKET_SIZES.TX_BY_ID)
  const txsBySPubKey: HashBase = await createOrOpen(disklet, 'hash', 'txsBySPubKey', BUCKET_SIZES.TXS_BY_SPUBKEY)
  const txsByDate: RangeBase = await createOrOpen(disklet, 'range', 'txsByDate', BUCKET_SIZES.TXS_BY_DATE)
  const utxoById: HashBase = await createOrOpen(disklet, 'hash', 'utxoById', BUCKET_SIZES.UTXO_BY_ID)
  const utxoIdsBySPubKey: HashBase = await createOrOpen(disklet, 'hash', 'utxoIdsBySPubKey', BUCKET_SIZES.UTXO_IDS_BY_SPUBKEY)
  const utxoIdsBySize: RangeBase = await createOrOpen(disklet, 'range', 'utxoIdsBySize', BUCKET_SIZES.UTXO_IDS_BY_SIZE)

  async function processAndSaveAddress(path: Path, data: IAddress) {
    const prefix = path.toChange(true)

    try {
      await Promise.all([
        addressByPath.insert(prefix, path.index, data),

        scriptPubKeysByBalance.insert('', {
          [RANGE_ID_KEY]: data.scriptPubKey,
          [RANGE_KEY]: Number(data.balance)
        }),

        addressPathBySPubKey.insert(
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
        scriptPubKeysByBalance.delete('', data.scriptPubKey),

        addressPathBySPubKey.delete('', [data.scriptPubKey]),

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
          inOout ? tx.addOurIns(i) : tx.addOurOuts(i)

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
    await txsBySPubKey.insert('', scriptPubKey, Array.from(set))
  }

  const fns: Processor = {
    async fetchAddress(path: Path): Promise<IAddress | null> {
      const lastQuery = Date.now()
      return fns.updateAddress(path, { lastQuery })
        .catch(() => null)
    },

    async fetchAddressPathBySPubKey(
      scriptPubKey: string
    ): Promise<string | null> {
      const [ path ] = await addressPathBySPubKey.query('', [ scriptPubKey ])
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
        await fns.updateAddress(path, {
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

    async saveAddress(
      path: Path,
      data: IAddressPartial
    ) {
      const hasScriptPubKey = await fns.hasSPubKey(data.scriptPubKey)
      if (hasScriptPubKey) {
        await fns.updateAddress(path, data)
        return
      }

      const values: IAddress = {
        lastQuery: 0,
        lastTouched: 0,
        used: false,
        balance: '0',
        ...data,
      }

      await processAndSaveAddress(path, values)
    },

    async updateAddress(path: Path, data: Partial<IAddress>): Promise<IAddress> {
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
        address.balance = data.balance

        promises.push(
          scriptPubKeysByBalance.update('', {
            [RANGE_ID_KEY]: address.scriptPubKey,
            [RANGE_KEY]: Number(address.balance)
          })
        )
      }

      const prefix = path.toChange(true)
      await Promise.all([
        ...promises,
        addressByPath.insert(prefix, path.index, address),
      ])

      return address
    },

    async updateAddressByScriptPubKey(
      scriptPubKey: string,
      data: Partial<IAddress>
    ) {
      const pathStr = await fns.fetchAddressPathBySPubKey(scriptPubKey)
      if (pathStr) {
        const path = makePathFromString(pathStr)
        await fns.updateAddress(path, data)
      }
    },

    async fetchTransaction(txId: string): Promise<ProcessorTransaction | null> {
      const [ data ] = await txById.query('', [ txId ])
      return data ? new ProcessorTransaction(data) : null
    },

    async fetchTransactionsByScriptPubKey(
      scriptHash: string
    ): Promise<string[]> {
      const [ txIds ] = await txsBySPubKey.query('', [ scriptHash ])
      return txIds ?? []
    },

    async saveTransaction(tx: ProcessorTransaction): Promise<ProcessorTransaction> {
      // Don't save the same transaction twice. Possible data overwrite
      const existingTx = await fns.fetchTransaction(tx.txid)
      if (!existingTx) {
        await txsByDate.insert('', {
          [RANGE_ID_KEY]: tx.txid,
          [RANGE_KEY]: tx.date
        })
      }

      await processTransaction(tx)

      return tx
    },

    async updateTransaction(
      txId: string,
      data: Pick<IProcessorTransaction, 'blockHeight'>
    ) {
      const txData = await fns.fetchTransaction(txId)
      if (!txData) return

      if (data.blockHeight != null) {
        txData.blockHeight = data.blockHeight
      }

      await txById.insert('', txId, txData)
    },

    // TODO: delete everything from db?
    async dropTransaction(txId: string) {
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
        const [ result = [] ] = await utxoIdsBySPubKey.query('', [ scriptPubKey ])
        ids = result
      } else {
        const result = await utxoIdsBySize.query('', 0, utxoIdsBySize.max(''))
        ids = result.map(({ [RANGE_ID_KEY]: id }) => id)
      }

      return ids.length === 0 ? [] : utxoById.query('', ids)
    },

    async saveUtxo(utxo: IUTXO) {
      await utxoById.insert('', utxo.id, utxo)
      await utxoIdsBySize.insert('', {
        [RANGE_ID_KEY]: utxo.id,
        [RANGE_KEY]: Number(utxo.value)
      })

      const [ utxoIds ] = await utxoIdsBySPubKey.query('', [ utxo.scriptPubKey ])
      const set = new Set(utxoIds)
      set.add(utxo.id)
      await utxoIdsBySPubKey.insert('', utxo.scriptPubKey, Array.from(set))
    },

    async removeUtxo(utxo: IUTXO) {
      await utxoById.delete('', [ utxo.id ])
      await utxoIdsBySize.delete('', utxo.id)
      await utxoIdsBySPubKey.delete('', [ utxo.scriptPubKey ])
    }
  }

  return fns
}
