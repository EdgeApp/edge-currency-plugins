import { Disklet } from 'disklet'
import { EdgeIo, EdgeLog } from 'edge-core-js/types'
import { makeMemlet } from 'memlet'

import { UtxoUserSettings } from '../utxobased/engine/types'
import { UtxoEngineProcessor } from '../utxobased/engine/UtxoEngineProcessor'
import {
  asServerCache,
  ServerCache,
  ServerList,
  ServerScores
} from './ServerScores'
import { InfoPayload } from './types'

// The filename for ServerInfoCache data (see ServerScores.ts)
// Perhaps this should be in ServerScores.ts file, but that'll take some refactoring
const SERVER_CACHE_FILE = 'serverCache.json'

/** A JSON object (as opposed to an array or primitive). */
interface JsonObject {
  [name: string]: unknown
}

/**
 * This object holds the plugin-wide per-currency caches.
 * Engine plugins are responsible for keeping it up to date.
 */
export interface PluginStateSettings {
  currencyCode: string
  defaultSettings: UtxoUserSettings
  infoPayload: InfoPayload | undefined
  io: EdgeIo
  log: EdgeLog
  pluginDisklet: Disklet
  pluginId: string
}

export interface PluginState {
  infoPayload: InfoPayload | undefined

  addEngine: (engineProcessor: UtxoEngineProcessor) => void
  removeEngine: (engineProcessor: UtxoEngineProcessor) => void
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
  const { defaultSettings, log, pluginDisklet, pluginId } = settings

  let engines: UtxoEngineProcessor[] = []
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

  const getInfoPayloadServers = async (): Promise<string[]> => {
    if (instance.infoPayload == null) {
      log.warn(`info server list list empty`)
      return []
    }

    const servers = Object.keys(instance.infoPayload.blockbookServers)
    log.warn(`info server list`, servers)

    return servers
  }

  const instance: PluginState = {
    infoPayload: settings.infoPayload,

    /**
     * Begins notifying the engine of state changes. Used at connection time.
     */
    addEngine(engineProcessor: UtxoEngineProcessor): void {
      engines.push(engineProcessor)
    },

    /**
     * Stops notifying the engine of state changes. Used at disconnection time.
     */
    removeEngine(engineProcessor: UtxoEngineProcessor): void {
      engines = engines.filter(engine => engine !== engineProcessor)
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
        const infoPayloadServers = await getInfoPayloadServers()
        newServers =
          infoPayloadServers.length > 0
            ? // Use the servers from the info-server
              infoPayloadServers
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

    async updateServers(newSettings: UtxoUserSettings): Promise<void> {
      const isServerListMatching = (): boolean => {
        const currentCustomServers = Object.keys(serverCache.customServers)
        const newServers = new Set(newSettings.blockbookServers)
        const existingServers = new Set(currentCustomServers)
        if (newServers.size !== existingServers.size) return false
        for (const server of newSettings.blockbookServers) {
          if (!existingServers.has(server)) return false
        }
        return true
      }

      // If no changes to the user settings, then exit early
      if (
        newSettings.enableCustomServers === serverCache.enableCustomServers &&
        isServerListMatching()
      ) {
        return
      }

      // Force enableCustomServers to false server list is empty because
      // an empty server list would cause the wallets to never sync, and
      // this is unlikely the user's intention.
      // This means policy change was decided later, which makes
      // `enableCustomServers` functionally only useful for disabling custom
      // servers entirely even when passing a list of servers (which could have
      // been done by passing an empty list to begin with).
      // In other words, this field is more of an internal field to track whether
      // to treat the list a static or not (whether to fetch serve lists outside
      // of the list provided by the user or not).
      const enableCustomServers =
        newSettings.enableCustomServers &&
        newSettings.blockbookServers.length !== 0

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
        enableCustomServers,
        customServers: {}
      }
      serverCacheDirty = true
      await saveServerCache()
      await instance.refreshServers(newSettings.blockbookServers)
      for (const engine of enginesToBeStarted) {
        await engine.start()
      }
    }
  }

  return instance
}
