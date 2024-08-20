// Typescript translation from original code in edge-currency-bitcoin

import { asBoolean, asMaybe, asNumber, asObject, asString } from 'cleaners'
import { EdgeLog } from 'edge-core-js/types'

import { getUriKeyParams } from '../../util/uriKeyParams'

export type ServerInfo = ReturnType<typeof asServerInfo>
export const asServerInfo = asObject({
  serverUrl: asString,
  serverScore: asNumber,
  responseTime: asNumber,
  numResponseTimes: asNumber
})
export type ServerList = ReturnType<typeof asServerList>
export const asServerList = asObject(asServerInfo)

export type ServerCache = ReturnType<typeof asServerCache>
export const asServerCache = asObject({
  customServers: asServerList,
  enableCustomServers: asMaybe(asBoolean, false),
  internalServers: asServerList
})

const RESPONSE_TIME_UNINITIALIZED = 999999999
const MAX_SCORE = 500
const MIN_SCORE = -100
const DROPPED_SERVER_SCORE = -100
const RE_ADDED_SERVER_SCORE = -10

interface ServerScoresOptions {
  log: EdgeLog
  onDirtyServer?: (serverUrl: string) => void
}

export class ServerScores {
  scoresLastLoaded: number
  log: EdgeLog
  lastScoreUpTime: number
  onDirtyServer: (serverUrl: string) => void

  constructor(options: ServerScoresOptions) {
    const { log, onDirtyServer = () => {} } = options
    this.log = log
    this.scoresLastLoaded = Date.now()
    this.lastScoreUpTime = Date.now()
    this.onDirtyServer = onDirtyServer
  }

  /**
   * Loads the server scores with new and old servers, mutates the passed in
   * list of known servers.
   * @param knownServers: Map of ServerInfo objects by serverUrl. This should come from disk
   * @param newServers: Array<string> of new servers downloaded from the info server
   */
  serverScoresLoad(knownServers: ServerList, newServers: string[] = []): void {
    //
    // Add any new servers coming out of the info server
    //
    for (const newServer of newServers) {
      if (knownServers[newServer] === undefined) {
        const serverScoreObj: ServerInfo = {
          serverUrl: newServer,
          serverScore: 0,
          responseTime: RESPONSE_TIME_UNINITIALIZED,
          numResponseTimes: 0
        }
        knownServers[newServer] = serverScoreObj
      }
    }

    //
    // If there is a known server that is not on the newServers array, then
    // reduce it's score to reduce chances of using it.
    //
    for (const knownServerUrl in knownServers) {
      const knownServer = knownServers[knownServerUrl]
      let match = false
      for (const newServerUrl of newServers) {
        if (newServerUrl === knownServerUrl) {
          match = true
          break
        }
      }

      let serverScore = knownServer.serverScore
      if (!match) {
        if (serverScore > DROPPED_SERVER_SCORE) {
          serverScore = DROPPED_SERVER_SCORE
        }
      } else {
        if (serverScore < RE_ADDED_SERVER_SCORE) {
          serverScore = RE_ADDED_SERVER_SCORE
        }
      }

      if (this.scoresLastLoaded === 0) {
        serverScore = Math.min(serverScore, MAX_SCORE - 100)
      }

      if (knownServerUrl.startsWith('ws') && serverScore > 0) {
        serverScore = 0
        knownServer.responseTime = RESPONSE_TIME_UNINITIALIZED
      }

      const hasKeyParams = getUriKeyParams(knownServerUrl).length > 0
      if (hasKeyParams) {
        // Lower the score on servers which require key params (e.g. NOWNodes).
        // This is because public, non-authenticated nodes are more affordable.
        // Decrease score by half (or decrease by 50%).
        serverScore = serverScore - (MAX_SCORE + MIN_SCORE)
      }

      knownServer.serverScore = serverScore
      this.onDirtyServer(knownServerUrl)
    }
  }

  clearServerScoreTimes(): void {
    this.scoresLastLoaded = Date.now()
    this.lastScoreUpTime = Date.now()
  }

  printServers(servers: ServerList): void {
    this.log('**** printServers ****')
    const serverInfos: ServerInfo[] = []
    for (const s in servers) {
      serverInfos.push(servers[s])
    }
    // Sort by score
    serverInfos.sort((a: ServerInfo, b: ServerInfo) => {
      return b.serverScore - a.serverScore
    })

    for (const s of serverInfos) {
      const score = s.serverScore.toString()
      const response = s.responseTime.toString()
      const numResponse = s.numResponseTimes.toString()
      const url = s.serverUrl
      this.log(`ServerInfo ${score} ${response}ms ${numResponse} ${url}`)
    }
    this.log('**************************')
  }

  serverScoreUp(
    servers: ServerList,
    serverUrl: string,
    responseTimeMilliseconds: number,
    changeScore = 1
  ): void {
    const serverInfo: ServerInfo = servers[serverUrl]

    serverInfo.serverScore += changeScore
    if (serverInfo.serverScore > MAX_SCORE) {
      serverInfo.serverScore = MAX_SCORE
    }
    this.lastScoreUpTime = Date.now()

    if (responseTimeMilliseconds !== 0) {
      this.setResponseTime(servers, serverUrl, responseTimeMilliseconds)
    }

    this.log(
      `${serverUrl}: score UP to ${serverInfo.serverScore} ${responseTimeMilliseconds}ms`
    )
    this.onDirtyServer(serverUrl)
  }

  serverScoreDown(
    servers: ServerList,
    serverUrl: string,
    changeScore = 10
  ): void {
    const currentTime = Date.now()
    if (currentTime - this.lastScoreUpTime > 60000) {
      // It has been over 1 minute since we got an up-vote for any server.
      // Assume the network is down and don't penalize anyone for now
      this.log(`${serverUrl}: score DOWN cancelled`)
      return
    }
    const serverInfo: ServerInfo = servers[serverUrl]
    serverInfo.serverScore -= changeScore
    if (serverInfo.serverScore < MIN_SCORE) {
      serverInfo.serverScore = MIN_SCORE
    }

    if (serverInfo.numResponseTimes === 0) {
      this.setResponseTime(servers, serverUrl, 9999)
    }

    this.log(`${serverUrl}: score DOWN to ${serverInfo.serverScore}`)
    this.onDirtyServer(serverUrl)
  }

  setResponseTime(
    servers: ServerList,
    serverUrl: string,
    responseTimeMilliseconds: number
  ): void {
    const serverInfo: ServerInfo = servers[serverUrl]
    serverInfo.numResponseTimes++

    const oldTime = serverInfo.responseTime
    let newTime = 0
    if (RESPONSE_TIME_UNINITIALIZED === oldTime) {
      newTime = responseTimeMilliseconds
    } else {
      // Every 10th setting of response time, decrease effect of prior values by 5x
      if (serverInfo.numResponseTimes % 10 === 0) {
        newTime = (oldTime + responseTimeMilliseconds * 4) / 5
      } else {
        newTime = (oldTime + responseTimeMilliseconds) / 2
      }
    }
    serverInfo.responseTime = newTime
    this.onDirtyServer(serverUrl)
  }

  getServers(
    servers: ServerList,
    numServersWanted: number,
    includePatterns: Array<string | RegExp> = []
  ): string[] {
    if (servers == null || Object.keys(servers).length === 0) {
      return []
    }

    let serverInfos: ServerInfo[] = []
    let newServerInfos: ServerInfo[] = []
    //
    // Find new servers from the passed in servers
    //
    for (const s in servers) {
      const server = servers[s]
      serverInfos.push(server)
      if (
        server.responseTime === RESPONSE_TIME_UNINITIALIZED &&
        server.serverScore === 0
      ) {
        newServerInfos.push(server)
      }
    }
    if (serverInfos.length === 0) {
      return []
    }
    if (includePatterns.length > 0) {
      const filter = (server: ServerInfo): boolean => {
        for (const pattern of includePatterns) {
          // make sure that the server URL starts with the required pattern
          if (
            typeof pattern === 'string' &&
            server.serverUrl.indexOf(pattern) === 0
          )
            return true
          // Or make sure that the server URL matches regex
          if (pattern instanceof RegExp && pattern.test(server.serverUrl))
            return true
        }
        return false
      }
      serverInfos = serverInfos.filter(filter)
      newServerInfos = newServerInfos.filter(filter)
    }
    // Sort by score
    serverInfos.sort((a: ServerInfo, b: ServerInfo) => {
      return b.serverScore - a.serverScore
    })

    //
    // Take the top 50% of servers that have
    // 1. A score within 100 points of the highest score
    // 2. And a positive score of at least 5
    // 3. And a response time that is not RESPONSE_TIME_UNINITIALIZED
    //
    // Then sort those top servers by response time from lowest to highest
    //

    const startServerInfo = serverInfos[0]
    let numServerPass = 0
    let serverEnd = 0
    for (let i = 0; i < serverInfos.length; i++) {
      const serverInfo = serverInfos[i]
      if (serverInfo.serverScore < startServerInfo.serverScore - 100) {
        continue
      }
      if (serverInfo.serverScore < 5) {
        continue
      }
      if (serverInfo.responseTime >= RESPONSE_TIME_UNINITIALIZED) {
        continue
      }
      numServerPass++
      if (numServerPass < numServersWanted) {
        continue
      }
      if (numServerPass >= serverInfos.length / 2) {
        continue
      }
      serverEnd = i
    }

    let topServerInfos = serverInfos.slice(0, serverEnd)
    topServerInfos.sort((a: ServerInfo, b: ServerInfo) => {
      return a.responseTime - b.responseTime
    })
    topServerInfos = topServerInfos.concat(serverInfos.slice(serverEnd))

    const selectedServers = []
    let numServers = 0
    let numNewServers = 0
    for (const serverInfo of topServerInfos) {
      numServers++
      selectedServers.push(serverInfo.serverUrl)
      if (
        serverInfo.responseTime === RESPONSE_TIME_UNINITIALIZED &&
        serverInfo.serverScore === 0
      ) {
        numNewServers++
      }

      if (numServers >= numServersWanted) {
        break
      }

      if (numServers >= numServersWanted / 2 && numNewServers === 0) {
        if (newServerInfos.length >= numServersWanted - numServers) {
          break
        }
      }
    }

    // If this list does not have a new server in it, try to add one as we always want to give new
    // servers a try.
    if (numNewServers === 0) {
      for (const serverInfo of newServerInfos) {
        selectedServers.unshift(serverInfo.serverUrl)
        numServers++
        if (numServers >= numServersWanted) {
          break
        }
      }
    }

    return selectedServers
  }
}
