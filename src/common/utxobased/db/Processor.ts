import {
  createCountBase,
  createHashBase,
  createRangeBase,
  openBase
} from 'baselet'
import { CountBase } from 'baselet/src/CountBase'
import { HashBase } from 'baselet/src/HashBase'
import { RangeBase } from 'baselet/src/RangeBase'
import * as bs from 'biggystring'
import { Disklet } from 'disklet'

import { Path } from '../../Account/Path'
import { IAddress, IAddressOptional, IAddressRequired } from './Models/Address'
import { IProcessorTransaction, ProcessorTransaction } from './Models/ProcessorTransaction'
import { IUTXO } from './Models/UTXO'

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

const RANGE_ID_KEY = 'id'
const RANGE_KEY = 'rangeKey'

export class Processor {
  public queue: Array<{ name: string; args: any[] }> = []
  public queuePromise = Promise.resolve()

  private constructor(
    private readonly disklet: Disklet,
    private readonly addressByPath: CountBase,
    private readonly addressPathBySPubKey: HashBase,
    // TODO rangebase
    private readonly addressByMRU: CountBase,
    private readonly scriptPubKeyByBalance: RangeBase,
    private readonly txById: HashBase,
    private readonly txsBySPubKey: HashBase,
    private readonly txsByDate: RangeBase,
    private readonly utxoById: HashBase,
    private readonly utxoIdsBySPubKey: HashBase,
    private readonly utxoIdsBySize: RangeBase
  ) {
    setInterval(() => {
      if (this.queue.length === 0) return

      this.queuePromise = this.queuePromise.then(async () => {
        const { name, args } = this.queue[0]
        // @ts-expect-error
        await this[name]?.apply(this, args)
        this.queue.shift()
      })
    }, 300)
  }

  public static async init(disklet: Disklet) {
    async function createOrOpen(
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
    const baselets = await Promise.all([
      createOrOpen('count', 'addressByPath', BUCKET_SIZES.ADDRESS_BY_PATH),
      createOrOpen('hash', 'addressPathBySPubKey', BUCKET_SIZES.ADDRESS_PATH_BY_SPUBKEY),
      createOrOpen('count', 'addressByMRU', BUCKET_SIZES.ADDRESS_BY_MRU),
      createOrOpen('range', 'scriptPubKeyByBalance', BUCKET_SIZES.SCRIPT_PUB_KEY_BY_BALANCE),
      createOrOpen('hash', 'txById', BUCKET_SIZES.TX_BY_ID),
      createOrOpen('hash', 'txsBySPubKey', BUCKET_SIZES.TXS_BY_SPUBKEY),
      createOrOpen('range', 'txsByDate', BUCKET_SIZES.TXS_BY_DATE),
      createOrOpen('hash', 'utxoById', BUCKET_SIZES.UTXO_BY_ID),
      createOrOpen('hash', 'utxoIdsBySPubKey', BUCKET_SIZES.UTXO_IDS_BY_SPUBKEY),
      createOrOpen('range', 'utxoIdsBySize', BUCKET_SIZES.UTXO_IDS_BY_SIZE)
    ])
    return new Processor(disklet, ...baselets)
  }

  public async fetchAddress(path: Path): Promise<IAddress | null> {
    const address = await this._fetchAddress(path)

    // TODO: queueify
    if (address) {
      await this.saveAddress(path, {
        ...address,
        lastQuery: Date.now()
      }, true)
    }

    return address
  }

  private async _fetchAddress(path: Path): Promise<IAddress | null> {
    const prefix = path.toChange(true)
    const [data] = await this.addressByPath.query(prefix, path.index)
    return data
  }

  public async fetchAddressPathBySPubKey(
    scriptPubKey: string
  ): Promise<string | null> {
    const [path] = await this.addressPathBySPubKey.query('', [scriptPubKey])
    return path
  }

  public async hasSPubKey(scriptPubKey: string): Promise<boolean> {
    return this.fetchAddressPathBySPubKey(scriptPubKey).then(
      (sPubKey) => !!sPubKey
    )
  }

  public async fetchAddressesByPath(path: Path): Promise<IAddress[]> {
    const addresses = await this._fetchAddressesByPath(path)

    // TODO: queueify
    const now = Date.now()
    for (const address of addresses) {
      const path = Path.fromString(address.path)
      await this.saveAddress(path, {
        ...address,
        lastQuery: now
      }, true)
    }

    return addresses
  }

  private async _fetchAddressesByPath(path: Path): Promise<IAddress[]> {
    const prefix = path.toChange(true)
    const count = this.fetchAddressCountFromPathPartition(path)
    return this.addressByPath.query(prefix, 0, count - 1)
  }

  public fetchAddressCountFromPathPartition(path: Path): number {
    const prefix = path.toChange(true)
    return this.addressByPath.length(prefix)
  }

  // Returned in lowest first due to RangeBase
  public async fetchScriptPubKeysByBalance(): Promise<
    Array<{ id: string; range: string }>
  > {
    return this.scriptPubKeyByBalance.query('', 0, 100000000000000000000)
  }

  public async saveAddress(
    path: Path,
    data: IAddressRequired & IAddressOptional,
    onlyUpdate = false
  ) {
    const values = Object.assign(
      data,
      {
        lastQuery: 0,
        lastTouched: 0,
        used: false,
        balance: '0',
        ...data
      }
    ) as IAddress

    const prefix = path.toChange(true)
    await this.addressByPath.insert(prefix, path.index, values)

    // Moving scriptPubKey based on balance.
    await this.scriptPubKeyByBalance.move('', {
      ...values,
      [RANGE_ID_KEY]: values.scriptPubKey,
      [RANGE_KEY]: Number(values.balance)
    })

    if (onlyUpdate) return

    await this.addressPathBySPubKey.insert(
      '',
      values.scriptPubKey,
      path.toString(true)
    )
    // TODO: change to rangebase
    // await this.addressByMRU.insert('', index, values)

    // Find transactions associated with this scriptPubKey, process the balances and save it
    const txIds = await this.fetchTransactionsByScriptPubKey(data.scriptPubKey)
    for (const txId of txIds) {
      const txData = await this.fetchTransaction(txId)
      if (txData) {
        await this.processTransaction(txData)
        await this.txById.insert('', txData.txid, txData)
      }
    }
  }

  public async updateAddress(path: Path, data: Partial<IAddress>) {
    const address = await this._fetchAddress(path)
    if (!address) return

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

    if (data.used != null) {
      address.used = data.used
    }

    if (data.balance != null) {
      address.balance = data.balance
    }

    await this.saveAddress(path, address, true)
  }

  public async updateAddressByScriptPubKey(
    scriptPubKey: string,
    data: Partial<IAddress>
  ) {
    const pathStr = await this.fetchAddressPathBySPubKey(scriptPubKey)
    if (pathStr) {
      const path = Path.fromString(pathStr)
      await this.updateAddress(path, data)
    }
  }

  public async fetchTransaction(txId: string): Promise<ProcessorTransaction | null> {
    const [data] = await this.txById.query('', [txId])
    return data ? ProcessorTransaction.fromEdgeTransaction(data) : null
  }

  public async fetchTransactionsByScriptPubKey(
    scriptHash: string
  ): Promise<string[]> {
    const [txIds] = await this.txsBySPubKey.query('', [scriptHash])
    return txIds ?? []
  }

  public async addTransaction(tx: ProcessorTransaction) {
    // Don't save the same transaction twice. Possible data overwrite
    const existingTx = await this.fetchTransaction(tx.txid)
    if (!existingTx) {
      await this.txsByDate.insert('', {
        id: tx.txid,
        range: tx.date
      })
    }

    await this.processTransaction(tx)

    return tx
  }

  private async processTransaction(tx: ProcessorTransaction): Promise<ProcessorTransaction> {
    for (const inOout of [true, false]) {
      const arr = inOout ? tx.inputs : tx.outputs
      for (let i = 0; i < arr.length; i++) {
        const { scriptPubKey } = arr[i]

        await this.saveTransactionByScriptPubKey(scriptPubKey, tx.txid)

        const own = await this.hasSPubKey(scriptPubKey)
        if (own) {
          inOout ? tx.addOurIns(i) : tx.addOurOuts(i)

          await this.updateAddressByScriptPubKey(scriptPubKey, {
            lastTouched: tx.date,
            used: true
          })
        }
      }
    }

    await this.txById.insert('', tx.txid, tx)

    return tx
  }

  private async saveTransactionByScriptPubKey(
    scriptPubKey: string,
    txId: string,
    save = true
  ) {
    const txIds = await this.fetchTransactionsByScriptPubKey(scriptPubKey)
    const set = new Set(txIds)
    save ? set.add(txId) : set.delete(txId)
    await this.txsBySPubKey.insert('', scriptPubKey, Array.from(set))
  }

  public async updateTransaction(
    txId: string,
    data: Pick<IProcessorTransaction, 'blockHeight'>
  ) {
    const txData = await this.fetchTransaction(txId)
    if (!txData) return

    if (data.blockHeight != null) {
      txData.blockHeight = data.blockHeight
    }

    await this.txById.insert('', txId, txData)
  }

  // TODO: delete everything from db?
  public async dropTransaction(txId: string) {
    const tx = await this.fetchTransaction(txId)
    if (!tx) return

    for (let i = 0; i < tx.inputs.length; i++) {
      const input = tx.inputs[i]

      await this.saveTransactionByScriptPubKey(input.scriptPubKey, txId, false)
    }

    for (let i = 0; i < tx.outputs.length; i++) {
      const output = tx.outputs[i]

      await this.saveTransactionByScriptPubKey(output.scriptPubKey, txId, false)
    }

    tx.blockHeight = -1
    await this.txById.insert('', tx.txid, tx)

    // TODO: recalculate balances
  }

  public async fetchBalance(path?: Path): Promise<string> {
    let balance: string
    if (path) {
      const address = await this._fetchAddress(path)
      balance = address?.balance ?? '0'
    } else {
      const result = await this.utxoIdsBySize.query('', 0, this.utxoIdsBySize.max(''))
      balance = result.reduce(
        (sum, { range }) => bs.add(sum, range.toString()),
        '0'
      )
    }

    return balance
  }

  public async fetchUtxos(scriptPubKey?: string): Promise<IUTXO[]> {
    let ids: string[] = []
    if (scriptPubKey) {
      const [result = []] = await this.utxoIdsBySPubKey.query('', [ scriptPubKey ])
      ids = result
    } else {
      const result = await this.utxoIdsBySize.query('', 0, this.utxoIdsBySize.max(''))
      ids = result.map(({ id }: { id: string }) => id)
    }

    return ids.length === 0 ? [] : this.utxoById.query('', ids)
  }

  public async addUTXO(utxo: IUTXO) {
    await this.utxoById.insert('', utxo.id, utxo)
    await this.utxoIdsBySize.insert('', {
      id: utxo.id,
      range: Number(utxo.value)
    })

    const [utxoIds] = await this.utxoIdsBySPubKey.query('', [utxo.scriptPubKey])
    const set = new Set(utxoIds)
    set.add(utxo.id)
    await this.utxoIdsBySPubKey.insert('', utxo.scriptPubKey, Array.from(set))
  }

  public async removeUtxo(utxo: IUTXO) {
    await this.utxoById.delete('', [utxo.id])
    await this.utxoIdsBySize.delete('', utxo.id)
    await this.utxoIdsBySPubKey.delete('', [utxo.scriptPubKey])
  }
}
