import * as bs from 'biggystring'
import {
  EdgeGetTransactionsOptions,
  EdgeTableSpec,
  EdgeTx,
  EdgeTxDatabase
} from 'edge-core-js/types'

import { unixTime } from '../../../util/unixTime'
import { AddressPath, ChangePath } from '../../plugin/types'
import {
  AddressData,
  TransactionData,
  TransactionDataInput,
  TransactionDataOutput,
  UtxoData
} from './types'

interface DataLayerConfig {
  /** This wallet's storage, from `EdgeCurrencyEngineOptions`. */
  txDatabase: EdgeTxDatabase
  walletId: string
  pluginId: string
}

/* Transaction table interfaces */

interface SaveTransactionArgs {
  tx: TransactionData
  scriptPubkeys?: string[]
}

interface FetchTransactionArgs {
  blockHeight?: number
  blockHeightMax?: number
  txId?: string
  options?: EdgeGetTransactionsOptions & {
    endDate?: Date
    startDate?: Date
    startEntries?: number
    startIndex?: number
  }
}

interface FetchUtxosArgs {
  utxoIds?: string[]
  scriptPubkey?: string
}

interface DumpDataReturn {
  databaseName: string
  data: unknown
}

/**
 * The tables this engine owns.
 *
 * Three replace eight baselets. Two hold what the plugin owns outright --
 * addresses and UTXOs -- and the third holds the part of a transaction the
 * core has no concept of.
 *
 * The five index baselets disappear. `txIdsByBlockHeight` and `txIdsByDate`
 * become predicates on the core's own index; `lastUsedByFormatPath` becomes
 * an ordered read of `byUsed`; and `utxoIdsByScriptPubkey` and
 * `scriptPubkeyByPath` become declared indexes rather than hand-maintained
 * inverted tables that a half-finished write could leave inconsistent.
 */
export const dataLayerTables: EdgeTableSpec = {
  version: 2,
  tables: {
    /*
     * The wallet's own state: its balance and the last block height it saw.
     *
     * Declared here rather than wherever it is used, because a wallet has one
     * table declaration -- a second `defineTables` with a different set would
     * drop the tables this one made.
     */
    meta: { key: ['id'] },

    address: {
      key: ['scriptPubkey'],
      indexes: {
        // Two addresses at one derivation path is the corruption
        // `saveAddress` used to check for by hand. Here the database refuses
        // it.
        byPath: {
          paths: ['$.path.format', '$.path.changeIndex', '$.path.addressIndex'],
          unique: true
        },
        // The highest used index for a change path, read in order rather than
        // kept as a running maximum some other write has to remember.
        byUsed: {
          paths: [
            '$.path.format',
            '$.path.changeIndex',
            '$.used',
            '$.path.addressIndex'
          ]
        }
      }
    },
    utxo: {
      key: ['id'],
      indexes: { byScriptPubkey: { paths: ['$.scriptPubkey'] } }
    },
    txDetail: { key: ['txid'] }
  }
}

/** The single row `meta` holds. */
export const WALLET_META_KEY = 'wallet'

/**
 * The UTXO-specific half of a transaction.
 *
 * `EdgeTx` is the transaction as every consumer sees it: date, height,
 * amounts, fees. The inputs, the outputs and which of them are ours are chain
 * detail the core deliberately does not model, so they live here under the
 * same txid. Reading a transaction joins the two back together.
 */
interface TxDetail {
  txid: string
  hex: string
  fees: string
  inputs: TransactionDataInput[]
  outputs: TransactionDataOutput[]
  ourIns: string[]
  ourOuts: string[]
}

/** The chain's own asset, which `EdgeTokenId` spells `null`. */
const CHAIN = null

/** Identifies a change path, for the counters the engine reads. */
export const addressPathToPrefix = (path: ChangePath): string =>
  `${path.format}_${path.changeIndex}`

/**
 * The Data Access Layer for the UTXO-based wallet engine.
 *
 * It provides all the methods necessary to interact with underlying
 * database/storage mechanism.
 */
export interface DataLayer {
  clearAll: () => Promise<void>
  dumpData: () => Promise<DumpDataReturn[]>

  saveUtxo: (utxo: UtxoData) => Promise<void>
  // remove either all UTXOs if the array is empty, or as selected from an array
  // of UTXO ids
  removeUtxos: (utxoIds: string[]) => Promise<void>
  // fetch either all UTXOs if the array is empty or as selected from an array
  // of UTXO ids
  fetchUtxos: (args: FetchUtxosArgs) => Promise<Array<UtxoData | undefined>>

  saveTransaction: (args: SaveTransactionArgs) => Promise<TransactionData>

  /**
   * A transaction and the UTXOs it creates, written together or not at all.
   *
   * Saving them separately is a window in which the transaction is recorded
   * and its own change output is not -- the balance understates, and those
   * coins are unspendable until a resync.
   */
  saveTransactionWithUtxos: (
    args: SaveTransactionArgs & { utxos: UtxoData[] }
  ) => Promise<TransactionData>

  /**
   * UTXO removals and writes, applied together or not at all.
   *
   * Removing first and writing second is a window in which the coins a
   * replacement spends are gone and nothing accounts for them.
   */
  updateUtxos: (args: { remove: string[]; save: UtxoData[] }) => Promise<void>
  numTransactions: () => number
  removeTransaction: (txId: string) => Promise<void>
  fetchTransactions: (
    args: FetchTransactionArgs
  ) => Promise<Array<TransactionData | undefined>>

  saveAddress: (args: AddressData) => Promise<void>
  // used to calculate total number of addresses
  numAddressesByFormatPath: (path: ChangePath) => number
  // get the last used address index for a specific format
  lastUsedIndexByFormatPath: (path: ChangePath) => Promise<number>
  fetchAddress: (args: AddressPath | string) => Promise<AddressData | undefined>
  /**
   * Several addresses at once, aligned to the script pubkeys that asked for
   * them, with `undefined` where one is not ours.
   *
   * Every call is a bridge round trip, so a caller walking a transaction's
   * outputs should pay for one crossing rather than one per output.
   */
  fetchAddresses: (
    scriptPubkeys: string[]
  ) => Promise<Array<AddressData | undefined>>
}

export async function makeDataLayer(
  config: DataLayerConfig
): Promise<DataLayer> {
  const { txDatabase: db, walletId, pluginId } = config
  await db.defineTables(dataLayerTables)

  /**
   * Calculates the transaction value supplied (negative) or received
   * (positive). In order to calculate a value, the `ourIns` and `ourOuts` of
   * the object must be populated with indices.
   */
  const calculateTxAmount = (tx: TransactionData): string => {
    interface TxIndexMap {
      [index: string]: TransactionDataInput | TransactionDataOutput
    }
    let ourAmount = '0'
    let txIndexMap: TxIndexMap = {}
    for (const input of tx.inputs) {
      txIndexMap[input.n.toString()] = input
    }
    for (const i of tx.ourIns) {
      const input = txIndexMap[i]
      ourAmount = bs.sub(ourAmount, input.amount)
    }
    txIndexMap = {}
    for (const output of tx.outputs) {
      txIndexMap[output.n.toString()] = output
    }
    for (const i of tx.ourOuts) {
      const output = txIndexMap[i]
      ourAmount = bs.add(ourAmount, output.amount)
    }
    return ourAmount
  }

  const splitTransaction = (
    tx: TransactionData
  ): { edgeTx: EdgeTx; detail: TxDetail } => ({
    edgeTx: {
      walletId,
      txid: tx.txid,
      pluginId,
      date: new Date(tx.date * 1000).toISOString(),
      blockHeight: tx.blockHeight,
      isSend: bs.lt(tx.ourAmount, '0'),
      nativeAmounts: new Map([[CHAIN, tx.ourAmount]]),
      networkFees: new Map([[CHAIN, tx.fees]]),
      ourReceiveAddresses: [],
      memos: [],
      tokenData: new Map(),
      signedTx: tx.hex
    },
    detail: {
      txid: tx.txid,
      hex: tx.hex,
      fees: tx.fees,
      inputs: tx.inputs,
      outputs: tx.outputs,
      ourIns: tx.ourIns,
      ourOuts: tx.ourOuts
    }
  })

  const joinTransaction = (tx: EdgeTx, detail: TxDetail): TransactionData => ({
    txid: tx.txid,
    hex: detail.hex,
    blockHeight: tx.blockHeight,
    // `EdgeConfirmationState` also carries 'failed' and 'syncing', which this
    // type predates. Neither is a UTXO chain's answer, so they read as
    // unconfirmed rather than widening a type the engine switches on.
    confirmations:
      tx.confirmations === 'failed' || tx.confirmations === 'syncing'
        ? 'unconfirmed'
        : tx.confirmations,
    date: Math.round(new Date(tx.date).valueOf() / 1000),
    fees: detail.fees,
    inputs: detail.inputs,
    outputs: detail.outputs,
    ourIns: detail.ourIns,
    ourOuts: detail.ourOuts,
    ourAmount: tx.nativeAmounts.get(CHAIN) ?? '0'
  })

  /**
   * Puts both halves of a page of transactions back together.
   *
   * One `getRows` for the whole page rather than one per transaction, because
   * every call is a bridge round trip.
   */
  const joinTransactions = async (
    txs: EdgeTx[]
  ): Promise<TransactionData[]> => {
    if (txs.length === 0) return []
    const [result] = await db.getRows([
      { table: 'txDetail', keys: txs.map(tx => tx.txid) }
    ])
    const out: TransactionData[] = []
    txs.forEach((tx, i) => {
      const detail = result.rows[i] as TxDetail | undefined
      if (detail != null) out.push(joinTransaction(tx, detail))
    })
    return out
  }

  const fetchOneTransaction = async (
    txId: string
  ): Promise<TransactionData | undefined> => {
    const txs = await db.getTxs({ txids: [txId] })
    const [out] = await joinTransactions(txs)
    return out
  }

  /*
   * `numTransactions` and `numAddressesByFormatPath` are synchronous in this
   * interface and called from synchronous engine code, so they cannot become
   * queries. They are seeded once here and maintained on write, which is what
   * the baselets did too.
   */
  let numTransactions = await countTransactions(db)
  const addressCounts = await countAddresses(db)

  const bumpAddressCount = (path: AddressPath): void => {
    const key = addressPathToPrefix(path)
    addressCounts.set(key, (addressCounts.get(key) ?? 0) + 1)
  }

  /**
   * Merges an incoming transaction over whatever is stored.
   *
   * Shared by both save paths, so the atomic one cannot drift from the
   * ordinary one in how it accumulates `ourIns` and `ourOuts`.
   */
  const prepareTransaction = async (
    tx: TransactionData,
    scriptPubkeys: string[]
  ): Promise<{ tx: TransactionData; isNew: boolean }> => {
    const existing = await fetchOneTransaction(tx.txid)
    const transaction = existing ?? tx

    for (const scriptPubkey of scriptPubkeys) {
      for (const input of transaction.inputs) {
        if (input.scriptPubkey === scriptPubkey) {
          if (!transaction.ourIns.includes(input.n.toString())) {
            transaction.ourIns.push(input.n.toString())
          }
        }
      }
      for (const output of transaction.outputs) {
        if (output.scriptPubkey === scriptPubkey) {
          if (!transaction.ourOuts.includes(output.n.toString())) {
            transaction.ourOuts.push(output.n.toString())
          }
        }
      }
      transaction.ourAmount = calculateTxAmount(transaction)
    }

    transaction.blockHeight = tx.blockHeight
    return { tx: transaction, isNew: existing == null }
  }

  const dataLayer: DataLayer = {
    async clearAll(): Promise<void> {
      // `runSql` is what makes this possible at all: the row API removes rows
      // by key, and there is no key list for "everything".
      await db.runSql`DELETE FROM ${db.address}`
      await db.runSql`DELETE FROM ${db.utxo}`
      await db.runSql`DELETE FROM ${db.txDetail}`
      // Through the scoped view, so this can only ever reach this wallet:
      await db.runSql`DELETE FROM ${db.tx_chain}`

      numTransactions = 0
      addressCounts.clear()
    },

    async dumpData(): Promise<DumpDataReturn[]> {
      const dump = async (table: string): Promise<DumpDataReturn> => ({
        databaseName: table,
        data: await db.findRows(table, {})
      })
      return [
        await dump('address'),
        await dump('utxo'),
        await dump('txDetail'),
        { databaseName: 'tx_chain', data: await db.getTxs({ limit: 500 }) }
      ]
    },

    async saveUtxo(utxo: UtxoData): Promise<void> {
      // One row. The `utxoIdsByScriptPubkey` inverted table it replaces had to
      // be read, mutated and written back, and could disagree with the UTXOs
      // it indexed if a write stopped half way.
      await db.putRows([{ table: 'utxo', rows: [utxo] }])
    },

    async removeUtxos(utxoIds: string[]): Promise<void> {
      if (utxoIds.length === 0) return
      await db.removeRows([{ table: 'utxo', keys: utxoIds }])
    },

    async fetchUtxos(args): Promise<Array<UtxoData | undefined>> {
      const { scriptPubkey, utxoIds = [] } = args

      if (scriptPubkey != null) {
        const byScript = (await db.findRows('utxo', {
          equals: { '$.scriptPubkey': scriptPubkey }
        })) as UtxoData[]
        if (utxoIds.length === 0) return byScript
        const wanted = new Set(utxoIds)
        return byScript.filter(utxo => wanted.has(utxo.id))
      }

      if (utxoIds.length === 0) {
        return (await db.findRows('utxo', {})) as UtxoData[]
      }

      const [result] = await db.getRows([{ table: 'utxo', keys: utxoIds }])
      return result.rows as Array<UtxoData | undefined>
    },

    async saveTransaction(args: SaveTransactionArgs): Promise<TransactionData> {
      const { scriptPubkeys = [], tx } = args

      // The stored transaction wins if there is one, so `ourIns` and
      // `ourOuts` accumulate across the calls that discover them.
      const transaction = await prepareTransaction(tx, scriptPubkeys)

      // Both halves land together, which is what the height and date index
      // baselets could not promise: they were separate writes under a lock
      // that did not span them.
      const { edgeTx, detail } = splitTransaction(transaction.tx)
      await db.batchWrite({
        saveTxs: [edgeTx],
        putRows: [{ table: 'txDetail', rows: [detail] }]
      })

      if (transaction.isNew) ++numTransactions
      return transaction.tx
    },

    async saveTransactionWithUtxos({ tx, scriptPubkeys, utxos }) {
      const transaction = await prepareTransaction(tx, scriptPubkeys ?? [])
      const { edgeTx, detail } = splitTransaction(transaction.tx)

      await db.batchWrite({
        saveTxs: [edgeTx],
        putRows: [
          { table: 'txDetail', rows: [detail] },
          { table: 'utxo', rows: utxos }
        ]
      })

      if (transaction.isNew) ++numTransactions
      return transaction.tx
    },

    async updateUtxos({ remove, save }) {
      if (remove.length === 0 && save.length === 0) return
      await db.batchWrite({
        removeRows: remove.length > 0 ? [{ table: 'utxo', keys: remove }] : [],
        putRows: save.length > 0 ? [{ table: 'utxo', rows: save }] : []
      })
    },

    numTransactions(): number {
      return numTransactions
    },

    async removeTransaction(_txId: string): Promise<void> {
      return
    },

    async fetchTransactions(
      args: FetchTransactionArgs
    ): Promise<Array<TransactionData | undefined>> {
      const { blockHeightMax, txId, options } = args
      let { blockHeight } = args
      const out: Array<TransactionData | undefined> = []

      if (txId != null) {
        out.push(await fetchOneTransaction(txId))
      }

      if (blockHeightMax != null && blockHeight == null) blockHeight = 0
      if (blockHeight != null) {
        // A `blockHeight` with no maximum means that height exactly, which is
        // what the range index this replaces meant by a one-ended query.
        const txs = await db.getTxs({
          minBlockHeight: blockHeight,
          maxBlockHeight: blockHeightMax ?? blockHeight,
          sort: { field: 'blockHeight', direction: 'desc' },
          limit: 500
        })
        out.push(...(await joinTransactions(txs)))
      }

      if (options != null) {
        const {
          startEntries,
          startIndex,
          startDate = new Date(0),
          endDate = new Date()
        } = options

        const txs = await db.getTxs({
          afterDate: new Date(unixTime(startDate.getTime()) * 1000),
          beforeDate: new Date(unixTime(endDate.getTime()) * 1000),
          offset: startIndex,
          limit: startEntries ?? 500
        })
        out.push(...(await joinTransactions(txs)))
      }

      return out
    },

    async saveAddress(address: AddressData): Promise<void> {
      const [result] = await db.getRows([
        { table: 'address', keys: [address.scriptPubkey] }
      ])
      const existingAddress = result.rows[0] as AddressData | undefined

      // Insert routine:
      if (existingAddress == null) {
        if (address.path != null) {
          const [clash] = (await db.findRows('address', {
            equals: {
              '$.path.format': address.path.format,
              '$.path.changeIndex': address.path.changeIndex,
              '$.path.addressIndex': address.path.addressIndex
            }
          })) as AddressData[]
          if (clash != null && clash.scriptPubkey !== address.scriptPubkey) {
            throw new Error(
              'Attempted to save address with an existing path, but different script pubkey'
            )
          }
          bumpAddressCount(address.path)
        }
        await db.putRows([{ table: 'address', rows: [address] }])
        return
      }

      // Update routine. Every field here only ever moves forwards, which is
      // why this is a merge rather than a replace.
      if (
        address.lastQueriedBlockHeight > existingAddress.lastQueriedBlockHeight
      ) {
        existingAddress.lastQueriedBlockHeight = address.lastQueriedBlockHeight
      }
      if (address.lastQuery > existingAddress.lastQuery) {
        existingAddress.lastQuery = address.lastQuery
      }
      if (address.lastTouched > existingAddress.lastTouched) {
        existingAddress.lastTouched = address.lastTouched
      }
      if (address.balance != null) {
        existingAddress.balance = address.balance
      }

      /*
      Only update the path field if one was given and the existing address
      currently does not have one. We never update paths for addresses, only
      insert paths when they're not present.

      NOTE: Addresses can be stored in the db without a path due to the
      `EdgeCurrencyEngine.addGapLimitAddresses` function. Once an address
      path is known, it should never be updated
      */
      if (address.path != null && existingAddress.path == null) {
        existingAddress.path = address.path
        bumpAddressCount(address.path)
      }

      if (address.used && !existingAddress.used) {
        existingAddress.used = true
      }

      await db.putRows([{ table: 'address', rows: [existingAddress] }])
    },

    numAddressesByFormatPath(path: ChangePath): number {
      return addressCounts.get(addressPathToPrefix(path)) ?? 0
    },

    async lastUsedIndexByFormatPath(path: ChangePath): Promise<number> {
      // The `lastUsedByFormatPath` baselet was a running maximum, written by
      // whichever code path happened to notice. This reads the index instead,
      // so it cannot be stale.
      const [address] = (await db.findRows('address', {
        equals: {
          '$.path.format': path.format,
          '$.path.changeIndex': path.changeIndex,
          '$.used': true
        },
        orderBy: [{ path: '$.path.addressIndex', direction: 'desc' }],
        limit: 1
      })) as AddressData[]

      return address?.path?.addressIndex ?? -1
    },

    async fetchAddress(
      fetchAddressArg: AddressPath | string
    ): Promise<AddressData | undefined> {
      if (typeof fetchAddressArg === 'string') {
        const [result] = await db.getRows([
          { table: 'address', keys: [fetchAddressArg] }
        ])
        return result.rows[0] as AddressData | undefined
      }

      const path = fetchAddressArg
      const [address] = (await db.findRows('address', {
        equals: {
          '$.path.format': path.format,
          '$.path.changeIndex': path.changeIndex,
          '$.path.addressIndex': path.addressIndex
        }
      })) as AddressData[]
      return address
    },

    async fetchAddresses(
      scriptPubkeys: string[]
    ): Promise<Array<AddressData | undefined>> {
      if (scriptPubkeys.length === 0) return []
      const [result] = await db.getRows([
        { table: 'address', keys: scriptPubkeys }
      ])
      return result.rows as Array<AddressData | undefined>
    }
  }
  return dataLayer
}

async function countTransactions(db: EdgeTxDatabase): Promise<number> {
  const rows = await db.runSql<{ n: number }>`
    SELECT count(*) AS n FROM ${db.tx_chain}`
  return rows[0]?.n ?? 0
}

async function countAddresses(
  db: EdgeTxDatabase
): Promise<Map<string, number>> {
  const rows = await db.runSql<{
    format: string
    change: number
    n: number
  }>`
    SELECT doc ->> '$.path.format'      AS format,
           doc ->> '$.path.changeIndex' AS change,
           count(*)                     AS n
      FROM ${db.address}
     WHERE doc ->> '$.path.format' IS NOT NULL
     GROUP BY format, change`

  const out = new Map<string, number>()
  for (const row of rows) out.set(`${row.format}_${row.change}`, row.n)
  return out
}
