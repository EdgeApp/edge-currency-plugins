import { Disklet, makeMemoryDisklet } from 'disklet'
import { makeMemoryTxDatabase } from 'edge-core-js'
import {
  EdgeFetchFunction,
  EdgeFetchHeaders,
  EdgeFetchOptions,
  EdgeIo,
  EdgeLog,
  EdgePluginStore,
  EdgeTableSpec,
  EdgeTxDatabase
} from 'edge-core-js/types'

import { PluginInfo } from '../src/common/plugin/types'
import { EdgeCurrencyPluginNativeIo } from '../src/react-native'

export const makeFakePluginInfo = (): PluginInfo => {
  return {
    currencyInfo: {
      assetDisplayName: '',
      addressExplorer: '',
      chainDisplayName: '',
      currencyCode: '',
      defaultSettings: {},
      denominations: [],
      displayName: '',
      customFeeTemplate: [
        {
          type: 'nativeAmount',
          key: 'satPerByte',
          displayName: 'Satoshis Per Byte',
          displayMultiplier: '0'
        }
      ],
      metaTokens: [],
      pluginId: '',
      transactionExplorer: '',
      walletType: ''
    },
    engineInfo: {
      formats: ['bip44', 'bip32'],
      feeUpdateInterval: 0,
      gapLimit: 0,
      defaultFeeInfo: {
        lowFeeFudgeFactor: undefined,
        standardFeeLowFudgeFactor: undefined,
        standardFeeHighFudgeFactor: undefined,
        highFeeFudgeFactor: undefined,

        highFee: '1',
        lowFee: '2',
        standardFeeHigh: '3',
        standardFeeHighAmount: '4',
        standardFeeLow: '5',
        standardFeeLowAmount: '6',
        maximumFeeRate: undefined
      }
    },
    coinInfo: {
      name: 'bitcoin',
      segwit: true,
      coinType: 0,

      prefixes: {
        messagePrefix: ['\x18Bitcoin Signed Message:\n'],
        wif: [0x80],
        legacyXPriv: [0x0488ade4],
        legacyXPub: [0x0488b21e],
        wrappedSegwitXPriv: [0x049d7878],
        wrappedSegwitXPub: [0x049d7cb2],
        segwitXPriv: [0x04b2430c],
        segwitXPub: [0x04b24746],
        pubkeyHash: [0x00],
        scriptHash: [0x05],
        bech32: ['bc']
      }
    }
  }
}

export const makeFakeLog = (): EdgeLog => {
  const fakeLog = (): void => {
    return
  }
  fakeLog.breadcrumb = () => {
    return
  }
  fakeLog.crash = () => {
    return
  }
  fakeLog.warn = () => {
    return
  }
  fakeLog.error = () => {
    return
  }
  return fakeLog
}

/** A log that keeps each line with its level, for asserting on both. */
export const makeRecordingLog = (): {
  log: EdgeLog
  lines: Array<{ level: 'info' | 'warn' | 'error'; text: string }>
} => {
  const lines: Array<{ level: 'info' | 'warn' | 'error'; text: string }> = []
  const record = (level: 'info' | 'warn' | 'error') => (
    ...args: unknown[]
  ): void => {
    lines.push({ level, text: args.map(String).join(' ') })
  }
  const log = Object.assign(record('info'), {
    breadcrumb: () => {},
    crash: () => {},
    warn: record('warn'),
    error: record('error')
  })
  return { log, lines }
}

/**
 * An in-memory `EdgePluginStore`, the shape the core hands a plugin as
 * `pluginDatabase`, over the core's own memory database.
 *
 * The plugin options are built synchronously, and a memory database opens
 * asynchronously, so every call waits for it.
 */
export const makeMemoryPluginStore = (): EdgePluginStore & {
  database: Promise<EdgeTxDatabase>
} => {
  const database = makeMemoryTxDatabase({
    walletId: Buffer.alloc(32, 0x22).toString('base64'),
    pluginId: 'plugin'
  })
  const out: EdgePluginStore & { database: Promise<EdgeTxDatabase> } = {
    database,
    async defineTables(spec: EdgeTableSpec) {
      const db = await database
      await db.defineTables(spec)
      for (const table of Object.keys(spec.tables)) out[table] = db[table]
    },
    getRows: async requests => await (await database).getRows(requests),
    putRows: async writes => await (await database).putRows(writes),
    putRowsIfAbsent: async writes =>
      await (await database).putRowsIfAbsent(writes),
    removeRows: async removals => await (await database).removeRows(removals),
    findRows: async (table, query) =>
      await (await database).findRows(table, query),
    batchWrite: async ops => await (await database).batchWrite(ops),
    runSql: async (strings, ...values) =>
      await (await database).runSql(strings, ...values)
  }
  return out
}

/**
 * A disklet that refuses writes, the way the core's `legacyDisklet` does:
 * an engine may read and delete its old files, never write one.
 */
export const makeReadOnlyDisklet = (disklet: Disklet): Disklet => ({
  delete: async path => await disklet.delete(path),
  getData: async path => await disklet.getData(path),
  getText: async path => await disklet.getText(path),
  list: async path => await disklet.list(path),
  setData: async () => {
    throw new Error("The wallet's local storage is read-only")
  },
  setText: async () => {
    throw new Error("The wallet's local storage is read-only")
  }
})

interface FakeIoConfig {
  disklet?: Disklet
}
export const makeFakeIo = (config?: FakeIoConfig): EdgeIo => {
  return {
    // @ts-expect-error - assigned to null
    console: null,
    disklet: config?.disklet ?? makeMemoryDisklet(),
    fetch: makeFakeFetch(),
    random(bytes: number): Uint8Array {
      return new Uint8Array([...Array(bytes).keys()])
    },
    async scrypt(
      _data: Uint8Array,
      _salt: Uint8Array,
      _n: number,
      _r: number,
      _p: number,
      _dklen: number
    ): Promise<Uint8Array> {
      return new Uint8Array()
    }
  }
}

const makeFakeFetch = (): EdgeFetchFunction => async (
  _uri: string,
  _opts?: EdgeFetchOptions
) => {
  return {
    async arrayBuffer(): Promise<ArrayBuffer> {
      return new ArrayBuffer(0)
    },
    headers: {
      forEach: (
        _callback: (
          value: string,
          name: string,
          self: EdgeFetchHeaders
        ) => void,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _thisArg?: any
      ): undefined => {
        return undefined
      },
      get: (_name: string): string | null => {
        return null
      },
      has: (_name: string): boolean => {
        return false
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async json(): Promise<any> {
      return {}
    },
    ok: true,
    status: 200,
    async text(): Promise<string> {
      return await Promise.resolve('')
    }
  }
}

export const makeFakeNativeIo = (): {
  'edge-currency-plugins': EdgeCurrencyPluginNativeIo
} => {
  return {
    'edge-currency-plugins': {}
  }
}
