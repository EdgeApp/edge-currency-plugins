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
  refreshServers: () => Promise<void>
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
  const builtInServers: string[] = defaultSettings.blockbookServers
  let customServers: string[] = []
  let enableCustomServers = defaultSettings.enableCustomServers
  let engines: UtxoEngineState[] = []
  const memlet = makeMemlet(pluginDisklet)

  let serverCache: ServerCache = {
    customServers: {},
    internalServers: {}
  }
  let serverCacheDirty = false
  let knownServers: ServerList = {}

  const saveServerCache = async (): Promise<void> => {
    serverScores.printServers(knownServers)
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

  const refreshServers = async (): Promise<void> => {
    let newServers: string[]
    if (enableCustomServers) {
      newServers = customServers
    } else {
      const fetchedServers = await fetchServers()
      newServers = fetchedServers.length > 0 ? fetchedServers : builtInServers
    }

    const serverCacheIndex = enableCustomServers
      ? 'customServers'
      : 'internalServers'

    knownServers = serverCache[serverCacheIndex]
    serverScores.serverScoresLoad(knownServers, newServers)
    await saveServerCache()

    // Tell the engines about the new servers:
    for (const engine of engines) {
      engine.refillServers()
    }
  }

  return {
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
        'pluginState.servers_': knownServers
      }
    },

    async load(): Promise<PluginState> {
      try {
        serverCache = asServerCache(await memlet.getJson(SERVER_CACHE_FILE))
      } catch (e) {
        log(`${pluginId}: Failed to load server cache: ${JSON.stringify(e)}`)
      }

      // Fetch servers in the background:
      refreshServers().catch(e => {
        log(`${pluginId} - ${JSON.stringify(e.toString())}`)
      })

      return this
    },

    serverScoreDown(uri: string): void {
      serverScores.serverScoreDown(knownServers, uri)
    },

    serverScoreUp(uri: string, score: number): void {
      serverScores.serverScoreUp(knownServers, uri, score)
    },

    async clearCache(): Promise<void> {
      serverScores.clearServerScoreTimes()
      knownServers = {}
      serverCacheDirty = true
      await memlet.delete(SERVER_CACHE_FILE)
    },

    getLocalServers(
      numServersWanted: number,
      includePatterns: Array<string | RegExp> = []
    ): string[] {
      return serverScores.getServers(
        knownServers,
        numServersWanted,
        includePatterns
      )
    },

    refreshServers,

    async updateServers(settings: UtxoUserSettings): Promise<void> {
      enableCustomServers = settings.enableCustomServers
      customServers = settings.blockbookServers

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
        customServers: {}
      }
      serverCacheDirty = true
      await saveServerCache()
      await refreshServers()
      for (const engine of enginesToBeStarted) {
        await engine.start()
      }
    }
  }
}
