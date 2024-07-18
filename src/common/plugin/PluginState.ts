// Typescript translation from original code in edge-currency-bitcoin

import { asArray, asEither, asNull, asObject, asString } from 'cleaners'
import { Disklet } from 'disklet'
import { EdgeIo, EdgeLog } from 'edge-core-js/types'
import { makeMemlet } from 'memlet'

import { UtxoUserSettings } from '../utxobased/engine/types'
import { UtxoEngineState } from '../utxobased/engine/UtxoEngineState'
import {
  asServerCache,
  ServerCache,
  ServerList,
  ServerScores
} from './ServerScores'

// Info server endpoint to getting ServerListInfo data
const serverListInfoUrl = 'https://info1.edge.app/v1/blockbook/'
// The filename for ServerInfoCache data (see ServerScores.ts)
// Perhaps this should be in ServerScores.ts file, but that'll take some refactoring
const SERVER_CACHE_FILE = 'serverCache.json'

// ServerListInfo data structure from info server and saved to disk
const asServerListInfo = asObject(asEither(asArray(asString), asNull))

/** A JSON object (as opposed to an array or primitive). */
interface JsonObject {
  [name: string]: unknown
}

/**
 * This object holds the plugin-wide per-currency caches.
 * Engine plugins are responsible for keeping it up to date.
 */
export interface PluginStateSettings {
  io: EdgeIo
  defaultSettings: UtxoUserSettings
  currencyCode: string
  pluginId: string
  pluginDisklet: Disklet
  log: EdgeLog
}

export interface PluginState {
  addEngine: (engineState: UtxoEngineState) => void
  removeEngine: (engineState: UtxoEngineState) => void
  dumpData: () => JsonObject
  load: () => Promise<PluginState>
  serverScoreDown: (uri: string) => void
  serverScoreUp: (uri: string, score: number) => void
  clearCache: () => Promise<void>
  getLocalServers: (
    numServersWanted: number,
    includePatterns?: Array<string | RegExp>
  ) => string[]
  refreshServers: (updatedCustomServers?: string[]) => Promise<void>
  updateServers: (settings: UtxoUserSettings) => Promise<void>
}

export function makePluginState(settings: PluginStateSettings): PluginState {
  const {
    io,
    defaultSettings,
    currencyCode,
    pluginId,
    pluginDisklet,
    log
  } = settings

  let engines: UtxoEngineState[] = []
  const memlet = makeMemlet(pluginDisklet)

  let serverCache: ServerCache = {
    customServers: {},
    enableCustomServers: defaultSettings.enableCustomServers,
    internalServers: {}
  }
  let serverCacheDirty = false

  const getSelectedServerList = (): ServerList => {
    const serverCacheIndex = serverCache.enableCustomServers
      ? 'customServers'
      : 'internalServers'
    return serverCache[serverCacheIndex]
  }

  const saveServerCache = async (): Promise<void> => {
    serverScores.printServers(getSelectedServerList())
    if (serverCacheDirty) {
      await memlet.setJson(SERVER_CACHE_FILE, serverCache).catch(e => {
        log(`${pluginId} - ${JSON.stringify(e.toString())}`)
      })
      serverCacheDirty = false
      serverScores.scoresLastLoaded = Date.now()
      log(`${pluginId} - Saved server cache`)
    }
  }

  const onDirtyServer = (serverUrl: string): void => {
    serverCacheDirty = true
    for (const engine of engines) {
      if (engine.processedPercent === 1) {
        const isFound = engine.getServerList().includes(serverUrl)
        if (isFound) {
          saveServerCache().catch(e => {
            log(`${pluginId} - ${JSON.stringify(e.toString())}`)
          })
          // Early exit because the server cache is no longer dirty after
          // calling saveServerCache
          return
        }
      }
    }
  }

  const serverScores = new ServerScores({
    log,
    onDirtyServer
  })

  const fetchServers = async (): Promise<string[]> => {
    log(`${pluginId} - GET ${serverListInfoUrl}`)

    try {
      const response = await io.fetch(serverListInfoUrl)
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`)
      }
      const responseBody = await response.json()
      const serverListInfo = asServerListInfo(responseBody)

      return serverListInfo[currencyCode] ?? []
    } catch (error) {
      log.warn(
        `${pluginId} - GET ${serverListInfoUrl} failed: ${error.toString()}`
      )
      return []
    }
  }

  const instance: PluginState = {
    /**
     * Begins notifying the engine of state changes. Used at connection time.
     */
    addEngine(engineState: UtxoEngineState): void {
      engines.push(engineState)
    },

    /**
     * Stops notifying the engine of state changes. Used at disconnection time.
     */
    removeEngine(engineState: UtxoEngineState): void {
      engines = engines.filter(engine => engine !== engineState)
    },

    dumpData(): JsonObject {
      return {
        'pluginState.servers_': getSelectedServerList()
      }
    },

    async load(): Promise<PluginState> {
      try {
        serverCache = asServerCache(await memlet.getJson(SERVER_CACHE_FILE))
      } catch (e) {
        log(`${pluginId}: Failed to load server cache: ${JSON.stringify(e)}`)
      }

      // Fetch servers in the background:
      instance.refreshServers().catch(e => {
        log(`${pluginId} - ${JSON.stringify(e.toString())}`)
      })

      return this
    },

    serverScoreDown(uri: string): void {
      serverScores.serverScoreDown(getSelectedServerList(), uri)
    },

    serverScoreUp(uri: string, score: number): void {
      serverScores.serverScoreUp(getSelectedServerList(), uri, score)
    },

    async clearCache(): Promise<void> {
      serverScores.clearServerScoreTimes()
      serverCacheDirty = true
      await memlet.delete(SERVER_CACHE_FILE)
    },

    getLocalServers(
      numServersWanted: number,
      includePatterns: Array<string | RegExp> = []
    ): string[] {
      return serverScores.getServers(
        getSelectedServerList(),
        numServersWanted,
        includePatterns
      )
    },

    async refreshServers(updatedCustomServers?: string[]): Promise<void> {
      let newServers: string[]
      if (serverCache.enableCustomServers) {
        newServers =
          // Use the updated custom servers if provided
          updatedCustomServers ??
          // Use the existing custom servers from cache
          Object.keys(serverCache.customServers) ??
          // Use the default servers from info file as final fallback
          defaultSettings.blockbookServers
      } else {
        const fetchedServers = await fetchServers()
        newServers =
          fetchedServers.length > 0
            ? // Use the servers from the network query
              fetchedServers
            : // Use the default servers from info file as final fallback
              defaultSettings.blockbookServers
      }

      serverScores.serverScoresLoad(getSelectedServerList(), newServers)
      await saveServerCache()

      // Tell the engines about the new servers:
      for (const engine of engines) {
        engine.refillServers()
      }
    },

    async updateServers(settings: UtxoUserSettings): Promise<void> {
      const hasServerListChanged = (): boolean => {
        const currentCustomServers = Object.keys(serverCache.customServers)
        const newServers = new Set(settings.blockbookServers)
        const existingServers = new Set(currentCustomServers)
        if (newServers.size !== existingServers.size) return true
        for (const server of settings.blockbookServers) {
          if (existingServers.has(server)) continue
          return true
        }
        return false
      }

      // If no changes to the user settings, then exit early
      if (
        settings.enableCustomServers === serverCache.enableCustomServers &&
        !hasServerListChanged()
      ) {
        return
      }

      // Stop all engines and clear the server list:
      const enginesToBeStarted = []
      const disconnects = []
      for (const engine of engines) {
        enginesToBeStarted.push(engine)
        engine.setServerList([])
        disconnects.push(engine.stop())
      }
      await Promise.all(disconnects)
      serverScores.clearServerScoreTimes()

      // We must always clear custom servers in order to enforce a policy of
      // only using the exact customServers provided.
      serverCache = {
        ...serverCache,
        enableCustomServers: settings.enableCustomServers,
        customServers: {}
      }
      serverCacheDirty = true
      await saveServerCache()
      await instance.refreshServers(settings.blockbookServers)
      for (const engine of enginesToBeStarted) {
        await engine.start()
      }
    }
  }

  return instance
}
