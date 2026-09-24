import { Disklet } from 'disklet'
import {
  EdgeLog,
  EdgeTableRows,
  EdgeTx,
  EdgeTxDatabase
} from 'edge-core-js/types'

import { asLocalWalletMetadata } from '../../plugin/types'
import {
  dataLayerTables,
  splitTransactionRows,
  WALLET_META_KEY
} from './DataLayer'
import { asAddressData, asTransactionData, asUtxoData } from './types'

/**
 * Moving a wallet's baselet files into its rows, once.
 *
 * Baselet wrote each hash base as `tables/<name>/<key prefix>.json`, a flat
 * `{ [key]: value }` object, beside a `config.json`. Three of the eight hold
 * values; the other five were indexes, which are declared indexes and
 * predicates on the core's own transaction index now. So this is a file walk,
 * and `baselet` is not a dependency.
 *
 * The files are never deleted here and never written again. A resync deletes
 * them, through `deleteBaselets`, so a forgotten history cannot come back.
 */

export const baseletImportConfig = {
  /** Rows written per transaction. */
  chunkSize: 250,
  /** Test hook: runs before each chunk; rejecting stops the import there. */
  beforeChunk: undefined as ((index: number) => Promise<void>) | undefined
}

/** The `meta` row whose presence means the import has run. */
export const BASELET_IMPORT_KEY = 'baseletImport'
const MARKER_VERSION = 1

const BASELET_DIR = 'tables'
const METADATA_FILE = 'metadata.json'

interface MigrateBaseletsOptions {
  txDatabase: EdgeTxDatabase
  legacyDisklet: Disklet
  log: EdgeLog
  walletId: string
  pluginId: string
}

/** One row to write, or one transaction's two halves. */
type Item =
  | { table: string; row: object }
  | { table: 'txDetail'; row: object; edgeTx: EdgeTx }

export async function migrateBaselets(
  opts: MigrateBaseletsOptions
): Promise<void> {
  const { txDatabase: db, legacyDisklet, log, walletId, pluginId } = opts

  // Idempotent, and gives the import tables to write into before the
  // metadata and the data layer open them:
  await db.defineTables(dataLayerTables)

  const [marker] = await db.getRows([
    { table: 'meta', keys: [BASELET_IMPORT_KEY] }
  ])
  if (marker.rows[0] != null) return

  const failures: string[] = []
  const items: Item[] = []
  let addresses = 0
  let utxos = 0
  let txs = 0

  const root = await legacyDisklet.list().catch(() => ({}))
  const has = (name: string): boolean =>
    Object.keys(root).some(path => path === name)

  if (has(METADATA_FILE)) {
    try {
      const text = await legacyDisklet.getText(METADATA_FILE)
      const metadata = asLocalWalletMetadata(JSON.parse(text))
      items.push({ table: 'meta', row: { ...metadata, id: WALLET_META_KEY } })
    } catch (error: unknown) {
      failures.push(`${METADATA_FILE}: ${String(error)}`)
    }
  }

  if (has(BASELET_DIR)) {
    for (const value of await readHashBase(
      legacyDisklet,
      'utxoById',
      failures
    )) {
      const utxo = clean(asUtxoData, value, failures)
      if (utxo == null) continue
      items.push({ table: 'utxo', row: utxo })
      ++utxos
    }
    for (const value of await readHashBase(
      legacyDisklet,
      'addressByScriptPubkey',
      failures
    )) {
      const address = clean(asAddressData, value, failures)
      if (address == null) continue
      items.push({ table: 'address', row: address })
      ++addresses
    }
    for (const value of await readHashBase(legacyDisklet, 'txById', failures)) {
      const tx = clean(asTransactionData, value, failures)
      if (tx == null) continue
      const { edgeTx, detail } = splitTransactionRows(tx, walletId, pluginId)
      items.push({ table: 'txDetail', row: detail, edgeTx })
      ++txs
    }
  }

  // Always at least one chunk, which is the one that carries the marker:
  const { chunkSize } = baseletImportConfig
  const chunkCount = Math.max(1, Math.ceil(items.length / chunkSize))
  for (let index = 0; index < chunkCount; ++index) {
    await baseletImportConfig.beforeChunk?.(index)
    const chunk = items.slice(index * chunkSize, (index + 1) * chunkSize)
    await writeChunk(db, chunk, index === chunkCount - 1)
  }

  if (items.length > 0) {
    log.warn(
      `Imported ${addresses} addresses, ${utxos} UTXOs, ${txs} transactions from baselets`
    )
  }
  if (failures.length > 0) {
    log.warn(
      `Could not import ${failures.length} baselet entries: ${failures[0]}`
    )
  }
}

/**
 * Makes the legacy files unreachable, for a resync.
 *
 * The import never deletes them, so without this a resynced wallet whose
 * marker is later lost would read its forgotten history straight back in.
 */
export async function deleteBaselets(legacyDisklet: Disklet): Promise<void> {
  await legacyDisklet.delete(BASELET_DIR)
  await legacyDisklet.delete(METADATA_FILE)
}

/**
 * Writes one chunk, filling gaps only.
 *
 * A kill before the marker lands means the next start imports again, and by
 * then the killed session's engine may have written rows of its own -- newer
 * than any file. So rows go in only under keys that have none, and a
 * transaction the core already holds is left as it is.
 */
async function writeChunk(
  db: EdgeTxDatabase,
  chunk: Item[],
  last: boolean
): Promise<void> {
  const byTable = new Map<string, object[]>()
  const edgeTxs: EdgeTx[] = []
  for (const item of chunk) {
    const rows = byTable.get(item.table) ?? []
    rows.push(item.row)
    byTable.set(item.table, rows)
    if ('edgeTx' in item) edgeTxs.push(item.edgeTx)
  }

  let saveTxs: EdgeTx[] = []
  if (edgeTxs.length > 0) {
    const present = new Set(
      (await db.getTxs({ txids: edgeTxs.map(tx => tx.txid) })).map(
        tx => tx.txid
      )
    )
    saveTxs = edgeTxs.filter(tx => !present.has(tx.txid))
  }

  const putRowsIfAbsent: EdgeTableRows[] = []
  for (const [table, rows] of byTable) putRowsIfAbsent.push({ table, rows })

  await db.batchWrite({
    putRowsIfAbsent,
    saveTxs,
    // The marker rides in the final chunk, so it lands with the last rows
    // or not at all:
    putRows: last
      ? [
          {
            table: 'meta',
            rows: [{ id: BASELET_IMPORT_KEY, version: MARKER_VERSION }]
          }
        ]
      : []
  })
}

/** Every value in one hash base, from each of its bucket files. */
async function readHashBase(
  disklet: Disklet,
  name: string,
  failures: string[]
): Promise<unknown[]> {
  const out: unknown[] = []
  for (const path of await listFiles(disklet, `${BASELET_DIR}/${name}`)) {
    if (path.endsWith('/config.json')) continue
    try {
      const bucket: unknown = JSON.parse(await disklet.getText(path))
      if (bucket == null || typeof bucket !== 'object') {
        throw new TypeError('Expected an object')
      }
      out.push(...Object.values(bucket as { [key: string]: unknown }))
    } catch (error: unknown) {
      failures.push(`${path}: ${String(error)}`)
    }
  }
  return out
}

/** Every file under a folder, however deep. */
async function listFiles(disklet: Disklet, path: string): Promise<string[]> {
  const listing = await disklet.list(path).catch(() => ({}))
  const out: string[] = []
  for (const [child, type] of Object.entries(listing)) {
    if (type === 'folder') out.push(...(await listFiles(disklet, child)))
    else if (child !== path) out.push(child)
  }
  return out
}

function clean<T>(
  cleaner: (raw: unknown) => T,
  raw: unknown,
  failures: string[]
): T | undefined {
  try {
    return cleaner(raw)
  } catch (error: unknown) {
    failures.push(String(error))
  }
}
