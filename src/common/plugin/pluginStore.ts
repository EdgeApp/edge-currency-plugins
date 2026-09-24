import { asMaybe } from 'cleaners'
import { EdgePluginStore, EdgeTableSpec } from 'edge-core-js/types'

import {
  asServerInfo,
  ServerCache,
  ServerInfo,
  ServerList
} from './ServerScores'
import { asFeeInfo, FeeInfo } from './types'

/**
 * What this plugin keeps on the device, for every wallet at once.
 *
 * The fee estimate and the server scores used to be two JSON files in the
 * plugin's disklet, the server file rewritten whole whenever one score moved.
 * They are rows now, one per server, so a score change is one row.
 *
 * Nothing is imported from the old files: both are refetched within minutes
 * of a cold start, so they are left where they are and stop being read.
 */
export const pluginStoreTables: EdgeTableSpec = {
  version: 1,
  tables: {
    // One row, the fee document:
    fee: { key: ['id'] },
    // One row per server in each list, with its score. A server can be in
    // both lists, so the id names the list too:
    server: { key: ['id'] },
    // One row, whether the custom list is the one in use:
    setting: { key: ['id'] }
  }
}

const FEE_KEY = 'fees'
const SERVER_SETTING_KEY = 'servers'

type ListName = 'customServers' | 'internalServers'
const listNames: ListName[] = ['customServers', 'internalServers']

interface ServerRow extends ServerInfo {
  id: string
  list: ListName
  uri: string
}

export interface PluginStore {
  /** The stored fee document, cleaned over `fallback`. */
  loadFees: (fallback: FeeInfo) => Promise<FeeInfo>
  saveFees: (feeInfo: FeeInfo) => Promise<void>
  clearFees: () => Promise<void>

  /** The stored server lists, or undefined if nothing was ever saved. */
  loadServerCache: () => Promise<ServerCache | undefined>
  /** Writes only the servers that changed since the last load or save. */
  saveServerCache: (serverCache: ServerCache) => Promise<void>
  clearServerCache: () => Promise<void>
}

export function makePluginStore(store: EdgePluginStore): PluginStore {
  let defined: Promise<void> | undefined
  const ready = async (): Promise<void> => {
    if (defined == null) {
      const next = store.defineTables(pluginStoreTables)
      defined = next
      // A failure is tried again on the next call, rather than remembered:
      next.catch(() => {
        if (defined === next) defined = undefined
      })
    }
    return await defined
  }

  // Each server row as last read or written, so a save writes only the
  // rows that differ from it:
  let stored = new Map<string, string>()
  let storedSetting: boolean | undefined

  const instance: PluginStore = {
    async loadFees(fallback) {
      await ready()
      const [result] = await store.getRows([{ table: 'fee', keys: [FEE_KEY] }])
      const row = result.rows[0] as { doc?: unknown } | undefined
      return asMaybe(asFeeInfo(fallback), fallback)(row?.doc)
    },

    async saveFees(feeInfo) {
      await ready()
      await store.putRows([
        { table: 'fee', rows: [{ id: FEE_KEY, doc: feeInfo }] }
      ])
    },

    async clearFees() {
      await ready()
      await store.removeRows([{ table: 'fee', keys: [FEE_KEY] }])
    },

    async loadServerCache() {
      await ready()
      const [rows, [settings]] = await Promise.all([
        store.findRows('server', {}),
        store.getRows([{ table: 'setting', keys: [SERVER_SETTING_KEY] }])
      ])
      const setting = settings.rows[0] as
        | { enableCustomServers?: unknown }
        | undefined

      const out: ServerCache = {
        customServers: {},
        enableCustomServers: setting?.enableCustomServers === true,
        internalServers: {}
      }
      stored = new Map()
      storedSetting = setting == null ? undefined : out.enableCustomServers
      for (const raw of rows as ServerRow[]) {
        if (!listNames.includes(raw.list)) continue
        const info = asMaybe(asServerInfo)(raw)
        if (info == null) continue
        out[raw.list][raw.uri] = info
        const row = toRow(raw.list, raw.uri, info)
        stored.set(row.id, JSON.stringify(row))
      }
      if (setting == null && rows.length === 0) return undefined
      return out
    },

    async saveServerCache(serverCache) {
      await ready()
      const next = new Map<string, string>()
      const puts: ServerRow[] = []
      const removes: string[] = []

      for (const list of listNames) {
        const servers: ServerList = serverCache[list]
        for (const uri of Object.keys(servers)) {
          const row = toRow(list, uri, servers[uri])
          const text = JSON.stringify(row)
          next.set(row.id, text)
          if (stored.get(row.id) !== text) puts.push(row)
        }
      }
      for (const id of stored.keys()) {
        if (!next.has(id)) removes.push(id)
      }
      const settingChanged = storedSetting !== serverCache.enableCustomServers

      if (puts.length === 0 && removes.length === 0 && !settingChanged) return
      await store.batchWrite({
        removeRows:
          removes.length > 0 ? [{ table: 'server', keys: removes }] : undefined,
        putRows: [
          ...(puts.length > 0 ? [{ table: 'server', rows: puts }] : []),
          ...(settingChanged
            ? [
                {
                  table: 'setting',
                  rows: [
                    {
                      id: SERVER_SETTING_KEY,
                      enableCustomServers: serverCache.enableCustomServers
                    }
                  ]
                }
              ]
            : [])
        ]
      })
      stored = next
      storedSetting = serverCache.enableCustomServers
    },

    async clearServerCache() {
      await ready()
      // Every row, not just the ones this process has seen:
      await store.runSql`DELETE FROM ${store.server}`
      await store.removeRows([{ table: 'setting', keys: [SERVER_SETTING_KEY] }])
      stored = new Map()
      storedSetting = undefined
    }
  }
  return instance
}

function toRow(list: ListName, uri: string, info: ServerInfo): ServerRow {
  const { serverUrl, serverScore, responseTime, numResponseTimes } = info
  return {
    id: `${list}|${uri}`,
    list,
    uri,
    serverUrl,
    serverScore,
    responseTime,
    numResponseTimes
  }
}
