import { expect } from 'chai'
import { describe, it } from 'mocha'

import { makePluginState } from '../../../src/common/plugin/PluginState'
import {
  makePluginStore,
  pluginStoreTables
} from '../../../src/common/plugin/pluginStore'
import { ServerCache } from '../../../src/common/plugin/ServerScores'
import { asUtxoUserSettings } from '../../../src/common/utxobased/engine/types'
import {
  makeFakeIo,
  makeFakeLog,
  makeFakePluginInfo,
  makeMemoryPluginStore
} from '../../utils'

/**
 * The plugin's device-wide state, as rows.
 *
 * A "restart" here is a second `makePluginStore` over the same database,
 * which is what a new context on the same device hands the plugin.
 */

const serverInfo = (
  uri: string,
  serverScore: number
): ServerCache['customServers'][string] => ({
  serverUrl: uri,
  serverScore,
  responseTime: 100,
  numResponseTimes: 1
})

const serverCache = (): ServerCache => ({
  customServers: {},
  enableCustomServers: false,
  internalServers: {
    'wss://a': serverInfo('wss://a', 10),
    'wss://b': serverInfo('wss://b', 20),
    'wss://c': serverInfo('wss://c', 30)
  }
})

describe('pluginStore', function () {
  it('round-trips the fee document across a restart', async function () {
    const database = makeMemoryPluginStore()
    const fallback = makeFakePluginInfo().engineInfo.defaultFeeInfo
    const first = makePluginStore(database)
    expect(await first.loadFees(fallback)).eql(fallback)

    const fees = { ...fallback, lowFee: '7', highFee: '70' }
    await first.saveFees(fees)

    const second = makePluginStore(database)
    expect(await second.loadFees(fallback)).eql(fees)

    await second.clearFees()
    expect(await makePluginStore(database).loadFees(fallback)).eql(fallback)
  })

  it('reads an unusable fee row as the fallback', async function () {
    const database = makeMemoryPluginStore()
    const fallback = makeFakePluginInfo().engineInfo.defaultFeeInfo
    await database.defineTables(pluginStoreTables)
    await database.putRows([
      { table: 'fee', rows: [{ id: 'fees', doc: { lowFee: 12 } }] }
    ])
    expect(await makePluginStore(database).loadFees(fallback)).eql(fallback)
  })

  it('round-trips server scores across a restart', async function () {
    const database = makeMemoryPluginStore()
    const first = makePluginStore(database)
    expect(await first.loadServerCache()).equals(undefined)

    const cache = serverCache()
    cache.customServers['wss://a'] = serverInfo('wss://a', -5)
    cache.enableCustomServers = true
    await first.saveServerCache(cache)

    const second = makePluginStore(database)
    expect(await second.loadServerCache()).eql(cache)
  })

  it('writes one row when one score changes', async function () {
    const database = makeMemoryPluginStore()
    const store = makePluginStore(database)
    const cache = serverCache()
    await store.saveServerCache(cache)

    const rowids = async (): Promise<Map<string, [number, string]>> => {
      const rows = await database.runSql<{
        rowid: number
        key: string
        doc: string
      }>`SELECT rowid, key, doc FROM ${database.server}`
      return new Map(rows.map(row => [row.key, [row.rowid, row.doc]]))
    }
    const before = await rowids()

    const written: unknown[] = []
    const batchWrite = database.batchWrite
    database.batchWrite = async ops => {
      for (const put of ops.putRows ?? []) written.push(...put.rows)
      await batchWrite(ops)
    }
    cache.internalServers['wss://b'] = serverInfo('wss://b', 21)
    await store.saveServerCache(cache)

    expect(written.length).equals(1)
    const after = await rowids()
    for (const [key, [rowid, doc]] of before) {
      const [afterRowid, afterDoc] = after.get(key) ?? []
      expect(afterRowid).equals(rowid)
      if (key.endsWith('wss://b')) expect(afterDoc).not.equals(doc)
      else expect(afterDoc).equals(doc)
    }

    // Nothing changed, nothing written:
    written.length = 0
    await store.saveServerCache(cache)
    expect(written.length).equals(0)
  })

  it('removes a dropped server and keeps a uri in both lists apart', async function () {
    const database = makeMemoryPluginStore()
    const store = makePluginStore(database)
    const cache = serverCache()
    cache.customServers['wss://a'] = serverInfo('wss://a', 1)
    await store.saveServerCache(cache)

    delete cache.internalServers['wss://c']
    await store.saveServerCache(cache)

    const loaded = await makePluginStore(database).loadServerCache()
    expect(Object.keys(loaded?.internalServers ?? {})).deep.equals([
      'wss://a',
      'wss://b'
    ])
    expect(loaded?.customServers['wss://a'].serverScore).equals(1)
    expect(loaded?.internalServers['wss://a'].serverScore).equals(10)
  })

  it('clears every server, including ones this process never read', async function () {
    const database = makeMemoryPluginStore()
    await makePluginStore(database).saveServerCache(serverCache())

    const fresh = makePluginStore(database)
    await fresh.clearServerCache()
    expect(await makePluginStore(database).loadServerCache()).equals(undefined)
  })

  it('skips a server row that no longer cleans', async function () {
    const database = makeMemoryPluginStore()
    await database.defineTables(pluginStoreTables)
    await database.putRows([
      {
        table: 'server',
        rows: [
          {
            id: 'internalServers|wss://x',
            list: 'internalServers',
            uri: 'wss://x'
          },
          { id: 'other|wss://y', list: 'other', uri: 'wss://y' },
          {
            ...serverInfo('wss://z', 3),
            id: 'internalServers|wss://z',
            list: 'internalServers',
            uri: 'wss://z'
          }
        ]
      }
    ])
    const loaded = await makePluginStore(database).loadServerCache()
    expect(Object.keys(loaded?.internalServers ?? {})).deep.equals(['wss://z'])
  })

  it('retries table setup after a failure', async function () {
    const database = makeMemoryPluginStore()
    const defineTables = database.defineTables
    let failures = 1
    database.defineTables = async spec => {
      if (failures-- > 0) throw new Error('disk full')
      await defineTables(spec)
    }
    const store = makePluginStore(database)
    const fallback = makeFakePluginInfo().engineInfo.defaultFeeInfo
    let error: unknown
    await store.loadFees(fallback).catch(e => (error = e))
    expect(String(error)).includes('disk full')
    expect(await store.loadFees(fallback)).eql(fallback)
  })

  it('backs the plugin state, which keeps its servers across a restart', async function () {
    const database = makeMemoryPluginStore()
    const settings = {
      currencyCode: 'BTC',
      defaultSettings: asUtxoUserSettings({
        blockbookServers: ['wss://default'],
        enableCustomServers: false
      }),
      infoPayload: {
        blockbookServers: { 'wss://info': true }
      } as any,
      io: makeFakeIo(),
      log: makeFakeLog(),
      pluginId: 'bitcoin'
    }
    const state = makePluginState({
      ...settings,
      pluginStore: makePluginStore(database)
    })
    await state.load()
    await state.refreshServers()
    expect(state.getLocalServers(5)).deep.equals(['wss://info'])

    // The refresh saved the list it built:
    const saved = await makePluginStore(database).loadServerCache()
    expect(Object.keys(saved?.internalServers ?? {})).deep.equals([
      'wss://info'
    ])

    const restarted = makePluginState({
      ...settings,
      pluginStore: makePluginStore(database)
    })
    await restarted.load()
    await restarted.clearCache()
    expect(await makePluginStore(database).loadServerCache()).equals(undefined)
  })
})
