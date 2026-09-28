import { Disklet } from 'disklet'
import { EdgeIo, EdgeLog } from 'edge-core-js/types'
import { makeMemlet } from 'memlet'

import { UtxoUserSettings } from '../utxobased/engine/types'
import { UtxoEngineProcessor } from '../utxobased/engine/UtxoEngineProcessor'
import {
  asServerCache,
  ServerCache,
  ServerInfo,
  ServerList,
  ServerScores
} from './ServerScores'
import { InfoPayload } from './types'

/**
 * How long a server dropped for being out of sync stays out of the pick
 * order. Long enough for a lagging indexer to catch up, short enough that a
 * recovered server is tried again without an app restart. After expiry the
 * server is probed again on connect and dropped again if still behind.
 */
export const SERVER_QUARANTINE_MS = 5 * 60 * 1000

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
  /**
   * Keeps a server out of getLocalServers for a while. Shared by every
   * engine of this plugin, so one wallet's finding spares the others the
   * same connect-probe-drop cycle. In memory only: it does not outlive the
   * plugin, and a restart gives the server a fresh chance.
   */
  quarantineServer: (uri: string, durationMs?: number) => void
  isServerQuarantined: (uri: string) => boolean
  hasQuarantinedServers: () => boolean
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

  const sanitizeServerUri = (uri: string): string => {
    // `dumpData()` is often copied into support logs.
    // Strip anything that might accidentally contain credentials/tokens.
    // Keep scheme/host/path, but drop username/password + query/hash.
    // Avoid using the global `URL` class since it is not guaranteed to exist
    // in all runtime environments.
    const noQueryHash = uri.split(/[?#]/)[0]
    return noQueryHash.replace(
      /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^@/]*@)(.*)$/,
      '$1$3'
    )
  }

  const sanitizeServerList = (serverList: ServerList): JsonObject => {
    const out: JsonObject = {}

    for (const [serverUri, serverInfo] of Object.entries(serverList)) {
      const sanitizedUri = sanitizeServerUri(serverUri)
      const sanitizedInfo: ServerInfo = {
        ...serverInfo,
        serverUrl: sanitizeServerUri(serverInfo.serverUrl)
      }

      // In case sanitization causes collisions (ex: query string removed),
      // preserve all entries by suffixing the key.
      if (out[sanitizedUri] == null) {
        out[sanitizedUri] = sanitizedInfo
      } else {
        let i = 2
        while (out[`${sanitizedUri}#${i}`] != null) i++
        out[`${sanitizedUri}#${i}`] = sanitizedInfo
      }
    }

    return out
  }

  let engines: UtxoEngineProcessor[] = []
  const memlet = makeMemlet(pluginDisklet)

  // Server URI -> time (ms since epoch) at which the quarantine expires
  const quarantineExpiry = new Map<string, number>()

  const isServerQuarantined = (uri: string): boolean => {
    const expiry = quarantineExpiry.get(uri)
    if (expiry == null) return false
    if (expiry > Date.now()) return true
    quarantineExpiry.delete(uri)
    return false
  }

  const hasQuarantinedServers = (): boolean =>
    Array.from(quarantineExpiry.keys()).some(isServerQuarantined)

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
      const selectedServerList = getSelectedServerList()
      const infoServers = Object.keys(
        instance.infoPayload?.blockbookServers ?? {}
      ).map(sanitizeServerUri)

      return {
        'pluginState.servers_': sanitizeServerList(selectedServerList),
        quarantinedServers: Array.from(quarantineExpiry.keys())
          .filter(isServerQuarantined)
          .map(sanitizeServerUri),
        infoServers,
        customServers: Object.keys(serverCache.customServers).map(
          sanitizeServerUri
        ),
        enableCustomServers: serverCache.enableCustomServers
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

    quarantineServer(uri: string, durationMs = SERVER_QUARANTINE_MS): void {
      log.warn(`${pluginId} - quarantining ${uri} for ${durationMs}ms`)
      quarantineExpiry.set(uri, Date.now() + durationMs)
    },

    isServerQuarantined,
    hasQuarantinedServers,

    async clearCache(): Promise<void> {
      serverScores.clearServerScoreTimes()
      serverCacheDirty = true
      await memlet.delete(SERVER_CACHE_FILE)
    },

    getLocalServers(
      numServersWanted: number,
      includePatterns: Array<string | RegExp> = []
    ): string[] {
      // Withhold quarantined servers before ranking, so they cannot take
      // slots that lower-ranked healthy servers would otherwise fill:
      const eligibleServers: ServerList = {}
      for (const [uri, serverInfo] of Object.entries(getSelectedServerList())) {
        if (!isServerQuarantined(uri)) eligibleServers[uri] = serverInfo
      }
      return serverScores.getServers(
        eligibleServers,
        numServersWanted,
        includePatterns
      )
    },

    async refreshServers(updatedCustomServers?: string[]): Promise<void> {
      const serverList = getSelectedServerList()

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

        // Remove any server that's not included in the internal servers list.
        // This is so we can control removal of poor servers from the
        // info-server in real-time.
        const missingServers = Object.keys(serverList).filter(
          server => !newServers.includes(server)
        )
        serverScores.removeServers(serverList, missingServers)
      }

      serverScores.serverScoresLoad(serverList, newServers)
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
