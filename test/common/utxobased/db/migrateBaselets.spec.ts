import { expect } from 'chai'
import { Disklet, makeMemoryDisklet } from 'disklet'
import {
  EdgeCorePluginOptions,
  EdgeCurrencyEngineCallbacks,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyPlugin,
  EdgeTxDatabase,
  makeFakeIo,
  makeMemoryTxDatabase
} from 'edge-core-js'
import { readdirSync, readFileSync, statSync } from 'fs'
import { afterEach, describe, it } from 'mocha'
import { join } from 'path'

import { EngineEmitter } from '../../../../src/common/plugin/EngineEmitter'
import { makeMetadata } from '../../../../src/common/plugin/Metadata'
import {
  dataLayerTables,
  WALLET_META_KEY
} from '../../../../src/common/utxobased/db/DataLayer'
import {
  BASELET_IMPORT_KEY,
  baseletImportConfig,
  deleteBaselets,
  migrateBaselets
} from '../../../../src/common/utxobased/db/migrateBaselets'
import edgeCorePlugins from '../../../../src/index'
import { testLog } from '../../../util/testLog'
import {
  makeFakeNativeIo,
  makeMemoryPluginStore,
  makeReadOnlyDisklet,
  makeRecordingLog
} from '../../../utils'

/**
 * A wallet's baselet files, moved into its rows once.
 */

const WALLET_ID = Buffer.alloc(32, 0x44).toString('base64')

/** Every engine callback, doing nothing. */
const noCallbacks = new Proxy(
  {},
  { get: () => () => {} }
) as EdgeCurrencyEngineCallbacks
const PLUGIN_ID = 'bitcointestnet'

const address = (n: number): object => ({
  scriptPubkey: `a914${n}`,
  used: n % 2 === 0,
  lastQueriedBlockHeight: 100,
  lastQuery: 0,
  lastTouched: 0,
  balance: '0',
  path: { format: 'bip49', changeIndex: 0, addressIndex: n }
})

const utxo = (n: number): object => ({
  id: `tx${n}_0`,
  txid: `tx${n}`,
  vout: 0,
  value: '1000',
  scriptPubkey: `a914${n}`,
  script: 'ab',
  scriptType: 'p2sh',
  blockHeight: 100,
  spent: false
})

const tx = (n: number): object => ({
  txid: `tx${n}`,
  hex: 'ab',
  blockHeight: 100 + n,
  date: 1700000000 + n,
  fees: '10',
  inputs: [],
  outputs: [{ amount: '1000', n: 0, scriptPubkey: `a914${n}` }],
  ourIns: [],
  ourOuts: ['0'],
  ourAmount: '1000'
})

/**
 * A `tables/` directory laid out as baselet writes it: a `config.json` in
 * each base, and bucket files named by key prefix holding flat objects.
 */
async function writeBaselets(
  disklet: Disklet,
  counts: { addresses: number; utxos: number; txs: number }
): Promise<void> {
  const base = async (
    name: string,
    values: Array<[string, object]>
  ): Promise<void> => {
    await disklet.setText(
      `tables/${name}/config.json`,
      JSON.stringify({ type: 'HASH_BASE', prefixSize: 2 })
    )
    const buckets = new Map<string, { [key: string]: object }>()
    for (const [key, value] of values) {
      const prefix = key.slice(0, 2)
      const bucket = buckets.get(prefix) ?? {}
      bucket[key] = value
      buckets.set(prefix, bucket)
    }
    for (const [prefix, bucket] of buckets) {
      await disklet.setText(
        `tables/${name}/${prefix}.json`,
        JSON.stringify(bucket)
      )
    }
  }
  const range = (count: number): number[] =>
    Array.from({ length: count }, (_, i) => i)

  await base(
    'addressByScriptPubkey',
    range(counts.addresses).map(n => [`a914${n}`, address(n)])
  )
  await base(
    'utxoById',
    range(counts.utxos).map(n => [`tx${n}_0`, utxo(n)])
  )
  await base(
    'txById',
    range(counts.txs).map(n => [`tx${n}`, tx(n)])
  )
  // An index base, which is never read:
  await disklet.setText(
    'tables/txIdsByDate/config.json',
    JSON.stringify({ type: 'RANGE_BASE' })
  )
  await disklet.setText('tables/txIdsByDate/0.json', '[not json')
}

const metadataFile = {
  balance: '12345',
  addressBalances: { a9140: '12345' },
  lastSeenBlockHeight: 2000
}

async function freshDatabase(): Promise<EdgeTxDatabase> {
  return await makeMemoryTxDatabase({
    walletId: WALLET_ID,
    pluginId: PLUGIN_ID
  })
}

async function counts(
  db: EdgeTxDatabase
): Promise<{ addresses: number; utxos: number; details: number; txs: number }> {
  return {
    addresses: (await db.findRows('address', {})).length,
    utxos: (await db.findRows('utxo', {})).length,
    details: (await db.findRows('txDetail', {})).length,
    txs: (await db.getTxs({ limit: 10000 })).length
  }
}

async function hasMarker(db: EdgeTxDatabase): Promise<boolean> {
  const [result] = await db.getRows([
    { table: 'meta', keys: [BASELET_IMPORT_KEY] }
  ])
  return result.rows[0] != null
}

afterEach(function () {
  baseletImportConfig.chunkSize = 250
  baseletImportConfig.beforeChunk = undefined
})

describe('migrateBaselets', function () {
  it('imports every address, UTXO and transaction, and the balance', async function () {
    const files = makeMemoryDisklet()
    await writeBaselets(files, { addresses: 5, utxos: 3, txs: 4 })
    await files.setText('metadata.json', JSON.stringify(metadataFile))
    const db = await freshDatabase()
    const { log, lines } = makeRecordingLog()

    await migrateBaselets({
      txDatabase: db,
      legacyDisklet: makeReadOnlyDisklet(files),
      log,
      walletId: WALLET_ID,
      pluginId: PLUGIN_ID
    })

    expect(await counts(db)).deep.equals({
      addresses: 5,
      utxos: 3,
      details: 4,
      txs: 4
    })
    const [meta] = await db.getRows([
      { table: 'meta', keys: [WALLET_META_KEY] }
    ])
    expect(meta.rows[0]).deep.include({ balance: '12345' })
    expect(await hasMarker(db)).equals(true)

    // One counted line, at warn, which is what reaches a real log backend:
    expect(lines).deep.equals([
      {
        level: 'warn',
        text: 'Imported 5 addresses, 3 UTXOs, 4 transactions from baselets'
      }
    ])

    const [imported] = await db.getTxs({ txids: ['tx2'] })
    expect(imported.blockHeight).equals(102)
    expect(imported.nativeAmounts.get(null)).equals('1000')
  })

  it('reads two keys from one bucket as two rows, and skips config.json', async function () {
    const files = makeMemoryDisklet()
    // Keys `a9140` and `a9141` share the bucket `a9.json`:
    await writeBaselets(files, { addresses: 2, utxos: 0, txs: 0 })
    expect(
      Object.keys(
        await files.list('tables/addressByScriptPubkey')
      ).sort((a, b) => a.localeCompare(b))
    ).deep.equals([
      'tables/addressByScriptPubkey/a9.json',
      'tables/addressByScriptPubkey/config.json'
    ])
    const db = await freshDatabase()
    const { log, lines } = makeRecordingLog()
    await migrateBaselets({
      txDatabase: db,
      legacyDisklet: files,
      log,
      walletId: WALLET_ID,
      pluginId: PLUGIN_ID
    })
    expect((await counts(db)).addresses).equals(2)
    // Had `config.json` been read as a bucket, its values would have failed
    // the cleaner and been logged:
    expect(lines.map(line => line.text)).deep.equals([
      'Imported 2 addresses, 0 UTXOs, 0 transactions from baselets'
    ])
  })

  it('shows the imported balance on the same run, with no restart', async function () {
    const db = await freshDatabase()
    const files = makeMemoryDisklet()
    await files.setText('metadata.json', JSON.stringify(metadataFile))
    const log = makeRecordingLog().log

    await migrateBaselets({
      txDatabase: db,
      legacyDisklet: files,
      log,
      walletId: WALLET_ID,
      pluginId: PLUGIN_ID
    })
    const metadata = await makeMetadata({
      txDatabase: db,
      emitter: new EngineEmitter(),
      log
    })
    expect(metadata.state.balance).equals('12345')
  })

  it('does not list tables/ once the marker is there', async function () {
    const files = makeMemoryDisklet()
    await writeBaselets(files, { addresses: 1, utxos: 1, txs: 1 })
    const db = await freshDatabase()
    const log = makeRecordingLog().log
    await migrateBaselets({
      txDatabase: db,
      legacyDisklet: files,
      log,
      walletId: WALLET_ID,
      pluginId: PLUGIN_ID
    })

    const listed: string[] = []
    const spy: Disklet = {
      ...files,
      list: async path => {
        listed.push(path ?? '')
        return await files.list(path)
      },
      getText: async path => {
        throw new Error(`Read ${path}`)
      }
    }
    const { log: quiet, lines } = makeRecordingLog()
    await migrateBaselets({
      txDatabase: db,
      legacyDisklet: spy,
      log: quiet,
      walletId: WALLET_ID,
      pluginId: PLUGIN_ID
    })
    expect(listed).deep.equals([])
    expect(lines).deep.equals([])
  })

  it('writes the marker and logs nothing when there is nothing to import', async function () {
    for (const setUp of [
      async (_: Disklet) => {},
      async (files: Disklet) => {
        await files.setText('tables/utxoById/config.json', '{}')
      }
    ]) {
      const files = makeMemoryDisklet()
      await setUp(files)
      const db = await freshDatabase()
      const { log, lines } = makeRecordingLog()
      await migrateBaselets({
        txDatabase: db,
        legacyDisklet: files,
        log,
        walletId: WALLET_ID,
        pluginId: PLUGIN_ID
      })
      expect(await hasMarker(db)).equals(true)
      expect(lines).deep.equals([])
    }
  })

  it('still writes the marker when a file will not parse, and logs it once', async function () {
    const files = makeMemoryDisklet()
    await writeBaselets(files, { addresses: 2, utxos: 0, txs: 1 })
    await files.setText('tables/utxoById/zz.json', '{"torn": ')
    await files.setText('tables/txById/yy.json', '{"bad": {"txid": 1}}')
    await files.setText('metadata.json', '{"balance": 5')
    const db = await freshDatabase()
    const { log, lines } = makeRecordingLog()

    await migrateBaselets({
      txDatabase: db,
      legacyDisklet: files,
      log,
      walletId: WALLET_ID,
      pluginId: PLUGIN_ID
    })

    expect(await hasMarker(db)).equals(true)
    expect((await counts(db)).addresses).equals(2)
    expect(lines.length).equals(2)
    expect(lines.every(line => line.level === 'warn')).equals(true)
    expect(lines[0].text).equals(
      'Imported 2 addresses, 0 UTXOs, 1 transactions from baselets'
    )
    expect(lines[1].text).matches(/^Could not import 3 baselet entries: /)
  })

  it('finishes after a kill, with the same rows as a clean run', async function () {
    const files = makeMemoryDisklet()
    await writeBaselets(files, { addresses: 5, utxos: 5, txs: 5 })
    const log = makeRecordingLog().log
    const run = async (db: EdgeTxDatabase): Promise<void> =>
      await migrateBaselets({
        txDatabase: db,
        legacyDisklet: files,
        log,
        walletId: WALLET_ID,
        pluginId: PLUGIN_ID
      })

    const clean = await freshDatabase()
    await run(clean)

    baseletImportConfig.chunkSize = 4
    const killed = await freshDatabase()
    baseletImportConfig.beforeChunk = async index => {
      if (index === 1) throw new Error('killed')
    }
    let error: unknown
    await run(killed).catch(e => (error = e))
    expect(String(error)).includes('killed')
    expect(await hasMarker(killed)).equals(false)
    expect((await counts(killed)).utxos).equals(4)

    baseletImportConfig.beforeChunk = undefined
    await run(killed)
    expect(await hasMarker(killed)).equals(true)
    expect(await counts(killed)).deep.equals(await counts(clean))
  })

  it('leaves a row the engine wrote after a partial import', async function () {
    const files = makeMemoryDisklet()
    await writeBaselets(files, { addresses: 1, utxos: 1, txs: 1 })
    const db = await freshDatabase()
    await db.defineTables(dataLayerTables)

    // What the engine of a killed session wrote, newer than any file:
    const newer = { ...utxo(0), spent: true }
    await db.putRows([{ table: 'utxo', rows: [newer] }])
    await db.saveTxs([
      {
        walletId: WALLET_ID,
        txid: 'tx0',
        pluginId: PLUGIN_ID,
        date: new Date(1800000000 * 1000).toISOString(),
        blockHeight: 999,
        isSend: false,
        nativeAmounts: new Map([[null, '1000']]),
        networkFees: new Map([[null, '10']]),
        ourReceiveAddresses: [],
        memos: [],
        tokenData: new Map()
      }
    ])

    await migrateBaselets({
      txDatabase: db,
      legacyDisklet: files,
      log: makeRecordingLog().log,
      walletId: WALLET_ID,
      pluginId: PLUGIN_ID
    })
    const [kept] = await db.getRows([{ table: 'utxo', keys: ['tx0_0'] }])
    expect(kept.rows[0]).deep.include({ spent: true })
    const [tx0] = await db.getTxs({ txids: ['tx0'] })
    expect(tx0.blockHeight).equals(999)

    // The replacing write is what the import must not use:
    await db.putRows([{ table: 'utxo', rows: [utxo(0)] }])
    const [replaced] = await db.getRows([{ table: 'utxo', keys: ['tx0_0'] }])
    expect(replaced.rows[0]).deep.include({ spent: false })
  })

  it('imports nothing after a resync deleted the files', async function () {
    const files = makeMemoryDisklet()
    await writeBaselets(files, { addresses: 2, utxos: 2, txs: 2 })
    await files.setText('metadata.json', JSON.stringify(metadataFile))
    await files.setText('walletKeys.json', '{}')
    const db = await freshDatabase()
    const log = makeRecordingLog().log
    await migrateBaselets({
      txDatabase: db,
      legacyDisklet: files,
      log,
      walletId: WALLET_ID,
      pluginId: PLUGIN_ID
    })

    await deleteBaselets(makeReadOnlyDisklet(files))
    expect(Object.keys(await files.list())).deep.equals(['walletKeys.json'])

    // The marker lost, as a table version bump loses it:
    const fresh = await freshDatabase()
    const { log: quiet, lines } = makeRecordingLog()
    await migrateBaselets({
      txDatabase: fresh,
      legacyDisklet: files,
      log: quiet,
      walletId: WALLET_ID,
      pluginId: PLUGIN_ID
    })
    expect(await counts(fresh)).deep.equals({
      addresses: 0,
      utxos: 0,
      details: 0,
      txs: 0
    })
    expect(lines).deep.equals([])
  })
})

describe('UtxoEngine baselet import', function () {
  it('runs before the metadata, so the engine reports the imported balance', async function () {
    const fakeIo = makeFakeIo()
    const pluginOpts: EdgeCorePluginOptions = {
      initOptions: {},
      infoPayload: {},
      io: fakeIo,
      log: testLog,
      nativeIo: makeFakeNativeIo(),
      pluginDatabase: makeMemoryPluginStore(),
      pluginDisklet: makeMemoryDisklet()
    }
    const factory = edgeCorePlugins[PLUGIN_ID]
    if (typeof factory !== 'function') throw new Error('No plugin')
    const plugin = factory(pluginOpts) as EdgeCurrencyPlugin
    const tools = await plugin.makeCurrencyTools()
    const privateKeys = await tools.createPrivateKey('wallet:bitcoin-testnet')
    Object.assign(privateKeys, { coinType: 0, format: 'bip49' })
    const publicKeys = await tools.derivePublicKey({
      type: 'wallet:bitcoin-testnet',
      keys: privateKeys,
      id: WALLET_ID
    })

    const files = makeMemoryDisklet()
    await files.setText('metadata.json', JSON.stringify(metadataFile))
    const txDatabase = await freshDatabase()
    const { log, lines } = makeRecordingLog()
    const engineOpts: EdgeCurrencyEngineOptions = {
      callbacks: noCallbacks,
      log,
      legacyDisklet: makeReadOnlyDisklet(files),
      walletLocalEncryptedDisklet: makeReadOnlyDisklet(makeMemoryDisklet()),
      txDatabase,
      customTokens: {},
      enabledTokenIds: [],
      userSettings: {},
      walletSettings: {}
    }
    const engine = await plugin.makeCurrencyEngine(
      {
        type: 'wallet:bitcoin-testnet',
        keys: { ...privateKeys, ...publicKeys },
        id: WALLET_ID
      },
      engineOpts
    )
    expect(engine.getBalance({ tokenId: null })).equals('12345')
    expect(await hasMarker(txDatabase)).equals(true)
    // Only the metadata file was there, and it moved:
    expect(lines.filter(line => line.text.includes('baselets'))).deep.equals([
      {
        level: 'warn',
        text: 'Imported 0 addresses, 0 UTXOs, 0 transactions from baselets'
      }
    ])
    await engine.killEngine()
  })

  it('fails naming the database when the core gives none', async function () {
    const factory = edgeCorePlugins[PLUGIN_ID]
    if (typeof factory !== 'function') throw new Error('No plugin')
    const plugin = factory({
      initOptions: {},
      infoPayload: {},
      io: makeFakeIo(),
      log: testLog,
      nativeIo: makeFakeNativeIo(),
      pluginDatabase: makeMemoryPluginStore(),
      pluginDisklet: makeMemoryDisklet()
    }) as EdgeCurrencyPlugin
    const tools = await plugin.makeCurrencyTools()
    const keys = await tools.createPrivateKey('wallet:bitcoin-testnet')
    Object.assign(keys, { coinType: 0, format: 'bip49' })
    const publicKeys = await tools.derivePublicKey({
      type: 'wallet:bitcoin-testnet',
      keys,
      id: WALLET_ID
    })
    let error: unknown
    await plugin
      .makeCurrencyEngine(
        {
          type: 'wallet:bitcoin-testnet',
          keys: { ...keys, ...publicKeys },
          id: WALLET_ID
        },
        {
          callbacks: noCallbacks,
          log: testLog,
          legacyDisklet: makeMemoryDisklet(),
          walletLocalEncryptedDisklet: makeMemoryDisklet(),
          customTokens: {},
          enabledTokenIds: [],
          userSettings: {},
          walletSettings: {}
        }
      )
      .catch(e => (error = e))
    expect(String(error)).includes('transaction database')
  })
})

describe('no plugin file writes', function () {
  it('never writes a disklet file', function () {
    // The rename caught every handle the core changed; this catches the rest,
    // including a memlet, which writes through `setText` underneath.
    const offenders: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.(ts|js)$/.test(name)) {
          const text = readFileSync(path, 'utf8')
          if (/\.(setText|setData|setJson)\(/.test(text)) offenders.push(path)
        }
      }
    }
    const root = join(__dirname, '../../../..')
    walk(join(root, 'src'))
    try {
      walk(join(root, 'lib'))
    } catch (error: unknown) {
      // No build yet; `src` is what it is built from.
    }
    expect(offenders).deep.equals([])
  })
})
