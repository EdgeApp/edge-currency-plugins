import { expect } from 'chai'
import { makeFakeIo } from 'edge-core-js'
import {
  EdgeFetchOptions,
  EdgeFetchResponse,
  EdgeTransaction
} from 'edge-core-js/types'
import WS from 'ws'

import {
  EngineEmitter,
  EngineEvent
} from '../../../../src/common/plugin/EngineEmitter'
import {
  makeShareServerProbe,
  PluginState
} from '../../../../src/common/plugin/PluginState'
import { ServerConfig } from '../../../../src/common/plugin/types'
import {
  BROADCAST_ATTEMPT_TIMEOUT_MS,
  makeServerStates,
  NOWNODES_BROADCAST_DELAY_MS,
  ServerStates
} from '../../../../src/common/utxobased/engine/ServerStates'
import { SafeWalletInfo } from '../../../../src/common/utxobased/keymanager/cleaners'
import { makeFakeLog, makeFakePluginInfo } from '../../../utils'

const TXID = 'deadbeef'
const WS_PORT = 8556
const WS_URI = `ws://localhost:${WS_PORT}`

type HttpBehavior = 'ok' | 'fail' | 'hang'

interface FakeHttp {
  calls: string[]
  headers: { [uri: string]: { [key: string]: string } }
  fetchCors: (
    uri: string,
    opts?: EdgeFetchOptions
  ) => Promise<EdgeFetchResponse>
}

const makeFakeHttp = (behaviors: { [uri: string]: HttpBehavior }): FakeHttp => {
  const calls: string[] = []
  const headers: FakeHttp['headers'] = {}
  return {
    calls,
    headers,
    async fetchCors(
      uri: string,
      opts?: EdgeFetchOptions
    ): Promise<EdgeFetchResponse> {
      calls.push(uri)
      headers[uri] = { ...(opts?.headers ?? {}) }
      const base = Object.keys(behaviors).find(key => uri.startsWith(key))
      const behavior = base != null ? behaviors[base] : 'fail'
      if (behavior === 'hang') {
        // Accepts the connection and never answers:
        return await new Promise<EdgeFetchResponse>(() => {})
      }
      if (behavior === 'ok') {
        return ({
          ok: true,
          status: 200,
          json: async () => ({ result: TXID })
        } as unknown) as EdgeFetchResponse
      }
      return ({
        ok: false,
        status: 500,
        json: async () => ({})
      } as unknown) as EdgeFetchResponse
    }
  }
}

const quarantined: string[] = []
const fakePluginState = ({
  serverScoreUp: () => {},
  serverScoreDown: () => {},
  getLocalServers: () => [],
  quarantineServer: (uri: string) => {
    quarantined.push(uri)
  },
  isServerQuarantined: (uri: string) => quarantined.includes(uri),
  hasQuarantinedServers: () => quarantined.length > 0,
  shareServerProbe: makeShareServerProbe()
} as unknown) as PluginState

const resetFakePluginState = (): void => {
  quarantined.length = 0
  fakePluginState.shareServerProbe = makeShareServerProbe()
}

const fakeWalletInfo = ({
  id: 'fake-wallet-id',
  type: 'wallet:bitcoin',
  keys: {}
} as unknown) as SafeWalletInfo

const transaction = ({
  txid: TXID,
  signedTx: '0100000000'
} as unknown) as EdgeTransaction

const makeTestServerStates = (
  http: FakeHttp,
  httpUris: string[],
  options: {
    serverConfigs?: ServerConfig[]
    nowNodesApiKey?: string | null
    broadcastTimeoutMs?: number
  } = {}
): ServerStates => {
  const { nowNodesApiKey = 'test-key' } = options
  const pluginInfo = makeFakePluginInfo()
  pluginInfo.engineInfo.serverConfigs =
    options.serverConfigs ??
    (httpUris.length > 0 ? [{ type: 'blockbook-nownode', uris: httpUris }] : [])
  const serverStates = makeServerStates({
    engineEmitter: new EngineEmitter(),
    initOptions: nowNodesApiKey == null ? {} : { nowNodesApiKey },
    io: { ...makeFakeIo(), fetchCors: http.fetchCors },
    log: makeFakeLog(),
    pluginInfo,
    pluginState: fakePluginState,
    walletInfo: fakeWalletInfo,
    broadcastTimeoutMs: options.broadcastTimeoutMs
  })
  // No engine tasks to run in these tests:
  serverStates.setPickNextTaskCB(async function* () {
    return false
  })
  return serverStates
}

const waitFor = async (
  predicate: () => boolean,
  timeoutMs = 5000
): Promise<void> => {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor timed out')
    }
    await new Promise(resolve => setTimeout(resolve, 25))
  }
}

describe('ServerStates.broadcastTx', function () {
  this.timeout(15000)

  it('broadcasts over every HTTP server when no sockets are cached', async () => {
    const http = makeFakeHttp({
      'https://http-a.test': 'ok',
      'https://http-b.test': 'ok'
    })
    const serverStates = makeTestServerStates(http, [
      'https://http-a.test',
      'https://http-b.test'
    ])

    const result = await serverStates.broadcastTx(transaction)

    expect(result).to.equal(TXID)
    expect(http.calls).to.have.members([
      'https://http-a.test/api/v2/sendtx/',
      'https://http-b.test/api/v2/sendtx/'
    ])
  })

  it('resolves when at least one HTTP server accepts', async () => {
    const http = makeFakeHttp({
      'https://http-a.test': 'fail',
      'https://http-b.test': 'ok'
    })
    const serverStates = makeTestServerStates(http, [
      'https://http-a.test',
      'https://http-b.test'
    ])

    const result = await serverStates.broadcastTx(transaction)

    expect(result).to.equal(TXID)
    expect(http.calls).to.have.lengthOf(2)
  })

  it('rejects only after every HTTP attempt fails', async () => {
    const http = makeFakeHttp({
      'https://http-a.test': 'fail',
      'https://http-b.test': 'fail'
    })
    const serverStates = makeTestServerStates(http, [
      'https://http-a.test',
      'https://http-b.test'
    ])

    let error: unknown
    try {
      await serverStates.broadcastTx(transaction)
    } catch (e) {
      error = e
    }

    expect(error).to.be.instanceOf(Error)
    expect((error as Error).message).to.include('HTTP 500')
    expect(http.calls).to.have.lengthOf(2)
  })

  it('does not contact NOWNodes when Edge servers carry the broadcast', async () => {
    const http = makeFakeHttp({
      'https://public.test': 'ok',
      'https://nownodes.test': 'ok'
    })
    const serverStates = makeTestServerStates(http, [], {
      serverConfigs: [
        { type: 'blockbook', uris: ['https://public.test'] },
        { type: 'blockbook-nownode', uris: ['https://nownodes.test'] }
      ]
    })

    const result = await serverStates.broadcastTx(transaction)
    // Outlive the second-wave timer to prove it was cancelled:
    await new Promise(resolve =>
      setTimeout(resolve, NOWNODES_BROADCAST_DELAY_MS + 250)
    )

    expect(result).to.equal(TXID)
    expect(http.calls).to.deep.equal(['https://public.test/api/v2/sendtx/'])
  })

  it('goes to NOWNodes at once when Edge servers fail, with the api-key only there', async () => {
    const http = makeFakeHttp({
      'https://public.test': 'fail',
      'https://nownodes.test': 'ok'
    })
    const serverStates = makeTestServerStates(http, [], {
      serverConfigs: [
        { type: 'blockbook', uris: ['https://public.test'] },
        { type: 'blockbook-nownode', uris: ['https://nownodes.test'] }
      ]
    })

    const start = Date.now()
    const result = await serverStates.broadcastTx(transaction)

    expect(result).to.equal(TXID)
    // The whole first wave failed fast, so the second did not sit out the delay:
    expect(Date.now() - start).to.be.lessThan(NOWNODES_BROADCAST_DELAY_MS)
    expect(http.calls).to.deep.equal([
      'https://public.test/api/v2/sendtx/',
      'https://nownodes.test/api/v2/sendtx/'
    ])
    expect(http.headers['https://public.test/api/v2/sendtx/']).to.deep.equal({})
    expect(http.headers['https://nownodes.test/api/v2/sendtx/']).to.deep.equal({
      'api-key': 'test-key'
    })
  })

  it('skips NOWNodes servers but still uses public servers without a key', async () => {
    const http = makeFakeHttp({
      'https://public.test': 'ok',
      'https://nownodes.test': 'ok'
    })
    const serverStates = makeTestServerStates(http, [], {
      nowNodesApiKey: null,
      serverConfigs: [
        { type: 'blockbook', uris: ['https://public.test'] },
        { type: 'blockbook-nownode', uris: ['https://nownodes.test'] }
      ]
    })

    const result = await serverStates.broadcastTx(transaction)

    expect(result).to.equal(TXID)
    expect(http.calls).to.deep.equal(['https://public.test/api/v2/sendtx/'])
  })

  it('rejects when only NOWNodes servers exist and there is no key', async () => {
    const http = makeFakeHttp({ 'https://nownodes.test': 'ok' })
    const serverStates = makeTestServerStates(http, ['https://nownodes.test'], {
      nowNodesApiKey: null
    })

    let error: unknown
    try {
      await serverStates.broadcastTx(transaction)
    } catch (e) {
      error = e
    }

    expect((error as Error).message).to.include('No available connections')
    expect(http.calls).to.have.lengthOf(0)
  })

  it('times out an HTTP server that accepts and never answers', async () => {
    const http = makeFakeHttp({
      'https://http-a.test': 'hang',
      'https://http-b.test': 'fail'
    })
    const serverStates = makeTestServerStates(
      http,
      ['https://http-a.test', 'https://http-b.test'],
      { broadcastTimeoutMs: 300 }
    )

    const start = Date.now()
    let error: unknown
    try {
      await serverStates.broadcastTx(transaction)
    } catch (e) {
      error = e
    }

    expect((error as Error).message).to.match(/Timeout for broadcast|HTTP 500/)
    expect(Date.now() - start).to.be.lessThan(2000)
    expect(http.calls).to.have.lengthOf(2)
  })

  it('defaults the attempt timeout to the socket request timeout', () => {
    expect(BROADCAST_ATTEMPT_TIMEOUT_MS).to.equal(30000)
  })

  it('rejects immediately when there is nothing to broadcast to', async () => {
    const http = makeFakeHttp({})
    const serverStates = makeTestServerStates(http, [])

    let error: unknown
    try {
      await serverStates.broadcastTx(transaction)
    } catch (e) {
      error = e
    }

    expect((error as Error).message).to.include('No available connections')
    expect(http.calls).to.have.lengthOf(0)
  })

  describe('with a connected socket', () => {
    let websocketServer: WS.Server
    let serverStates: ServerStates
    const receivedMethods: string[] = []
    // How the fake server treats sendTransaction: swallow it, or refuse it
    // with a Blockbook error response.
    let sendTransactionReply: 'silent' | 'refuse' = 'silent'

    beforeEach(async () => {
      receivedMethods.length = 0
      sendTransactionReply = 'silent'
      websocketServer = new WS.Server({ port: WS_PORT })
      websocketServer.on('connection', (ws: WebSocket) => {
        ws.onmessage = event => {
          const data = JSON.parse(event.data)
          receivedMethods.push(data.method)
          switch (data.method) {
            case 'ping':
              ws.send(JSON.stringify({ id: data.id, data: {} }))
              break
            case 'getInfo':
              ws.send(
                JSON.stringify({
                  id: data.id,
                  data: {
                    name: 'Bitcoin',
                    shortcut: 'BTC',
                    decimals: 8,
                    version: '0.0.0',
                    bestHeight: 1,
                    bestHash: '00',
                    block0Hash: '00',
                    testnet: false
                  }
                })
              )
              break
            case 'sendTransaction':
              if (sendTransactionReply === 'refuse') {
                ws.send(
                  JSON.stringify({
                    id: data.id,
                    error: { message: 'Blockbook Error: -26: dust' }
                  })
                )
              }
              // Otherwise deliberately never answer: this socket looks
              // healthy but swallows the broadcast.
              break
          }
        }
      })
      await new Promise<void>(resolve =>
        websocketServer.on('listening', () => {
          resolve()
        })
      )
    })

    afterEach(async () => {
      serverStates.stop()
      await new Promise<void>(resolve => websocketServer.close(() => resolve()))
    })

    it('rejects instead of hanging when the socket refuses and there is no HTTP server', async () => {
      sendTransactionReply = 'refuse'
      const http = makeFakeHttp({})
      serverStates = makeTestServerStates(http, [])
      serverStates.setServerList([WS_URI])
      serverStates.refillServers()
      await waitFor(
        () =>
          serverStates.getServerState(WS_URI)?.blockbook.isConnected === true
      )

      const start = Date.now()
      let error: unknown
      try {
        await serverStates.broadcastTx(transaction)
      } catch (e) {
        error = e
      }

      expect((error as Error).message).to.include('-26: dust')
      // Settled by the server's refusal, not by the 30s request timeout:
      expect(Date.now() - start).to.be.lessThan(5000)
      expect(http.calls).to.have.lengthOf(0)
    })

    it('rejects instead of hanging when every socket and HTTP attempt fails', async () => {
      sendTransactionReply = 'refuse'
      const http = makeFakeHttp({ 'https://http-a.test': 'fail' })
      serverStates = makeTestServerStates(http, ['https://http-a.test'])
      serverStates.setServerList([WS_URI])
      serverStates.refillServers()
      await waitFor(
        () =>
          serverStates.getServerState(WS_URI)?.blockbook.isConnected === true
      )

      const start = Date.now()
      let error: unknown
      try {
        await serverStates.broadcastTx(transaction)
      } catch (e) {
        error = e
      }

      expect(error).to.be.instanceOf(Error)
      expect(Date.now() - start).to.be.lessThan(5000)
      expect(receivedMethods).to.include('sendTransaction')
      expect(http.calls).to.deep.equal(['https://http-a.test/api/v2/sendtx/'])
    })

    it('holds NOWNodes back for the delay, then resolves through HTTP rather than waiting on the socket', async () => {
      const http = makeFakeHttp({ 'https://http-a.test': 'ok' })
      serverStates = makeTestServerStates(http, ['https://http-a.test'])
      serverStates.setServerList([WS_URI])
      serverStates.refillServers()
      await waitFor(
        () =>
          serverStates.getServerState(WS_URI)?.blockbook.isConnected === true
      )

      const start = Date.now()
      const result = await serverStates.broadcastTx(transaction)
      const elapsed = Date.now() - start

      expect(result).to.equal(TXID)
      // Not before the delay (allowing timer slop), and well under the 30s
      // socket request timeout:
      expect(elapsed).to.be.at.least(NOWNODES_BROADCAST_DELAY_MS - 100)
      expect(elapsed).to.be.lessThan(5000)
      // The socket was tried first, and the transaction reached it:
      expect(receivedMethods).to.include('sendTransaction')
      expect(http.calls).to.deep.equal(['https://http-a.test/api/v2/sendtx/'])
    })

    it('rejects when the socket has refused and the only HTTP server hangs', async () => {
      // Bugbot's case: every socket attempt has settled as a failure, but a
      // hung HTTP attempt must not be able to hold the broadcast open forever.
      sendTransactionReply = 'refuse'
      const http = makeFakeHttp({ 'https://public.test': 'hang' })
      serverStates = makeTestServerStates(http, [], {
        broadcastTimeoutMs: 300,
        serverConfigs: [{ type: 'blockbook', uris: ['https://public.test'] }]
      })
      serverStates.setServerList([WS_URI])
      serverStates.refillServers()
      await waitFor(
        () =>
          serverStates.getServerState(WS_URI)?.blockbook.isConnected === true
      )

      const start = Date.now()
      let error: unknown
      try {
        await serverStates.broadcastTx(transaction)
      } catch (e) {
        error = e
      }

      expect(error).to.be.instanceOf(Error)
      expect(Date.now() - start).to.be.lessThan(2000)
      expect(receivedMethods).to.include('sendTransaction')
      expect(http.calls).to.deep.equal(['https://public.test/api/v2/sendtx/'])
    })

    it('fires NOWNodes at once when the socket and Edge servers have all failed', async () => {
      sendTransactionReply = 'refuse'
      const http = makeFakeHttp({
        'https://public.test': 'fail',
        'https://nownodes.test': 'ok'
      })
      serverStates = makeTestServerStates(http, [], {
        serverConfigs: [
          { type: 'blockbook', uris: ['https://public.test'] },
          { type: 'blockbook-nownode', uris: ['https://nownodes.test'] }
        ]
      })
      serverStates.setServerList([WS_URI])
      serverStates.refillServers()
      await waitFor(
        () =>
          serverStates.getServerState(WS_URI)?.blockbook.isConnected === true
      )

      const start = Date.now()
      const result = await serverStates.broadcastTx(transaction)

      expect(result).to.equal(TXID)
      expect(Date.now() - start).to.be.lessThan(NOWNODES_BROADCAST_DELAY_MS)
      expect(receivedMethods).to.include('sendTransaction')
      expect(http.calls).to.deep.equal([
        'https://public.test/api/v2/sendtx/',
        'https://nownodes.test/api/v2/sendtx/'
      ])
    })
  })
})

describe('ServerStates health probe', function () {
  this.timeout(15000)

  const HTTP_TWIN = `http://localhost:${WS_PORT}`
  let websocketServer: WS.Server
  let serverStates: ServerStates

  interface FakeProbe {
    calls: string[]
    fetchCors: (uri: string) => Promise<EdgeFetchResponse>
  }

  type ProbeReply = 'in-sync' | 'behind' | 'error' | 'garbage'

  const makeFakeProbe = (
    defaultReply: ProbeReply,
    repliesByPrefix: { [prefix: string]: ProbeReply } = {}
  ): FakeProbe => {
    const calls: string[] = []
    return {
      calls,
      async fetchCors(uri: string): Promise<EdgeFetchResponse> {
        calls.push(uri)
        const prefix = Object.keys(repliesByPrefix).find(key =>
          uri.startsWith(key)
        )
        const reply = prefix != null ? repliesByPrefix[prefix] : defaultReply
        if (reply === 'error') throw new Error('connection refused')
        return ({
          ok: true,
          status: 200,
          json: async () =>
            reply === 'garbage'
              ? { unexpected: true }
              : { blockbook: { inSync: reply === 'in-sync' } }
        } as unknown) as EdgeFetchResponse
      }
    }
  }

  const makeProbedServerStates = (
    probe: FakeProbe,
    serverConfigs: ServerConfig[],
    engineEmitter: EngineEmitter = new EngineEmitter(),
    serverList: string[] = [WS_URI]
  ): ServerStates => {
    const pluginInfo = makeFakePluginInfo()
    pluginInfo.engineInfo.serverConfigs = serverConfigs
    const states = makeServerStates({
      engineEmitter,
      initOptions: {},
      io: { ...makeFakeIo(), fetchCors: probe.fetchCors },
      log: makeFakeLog(),
      pluginInfo,
      pluginState: fakePluginState,
      walletInfo: fakeWalletInfo
    })
    states.setPickNextTaskCB(async function* () {
      return false
    })
    states.setServerList(serverList)
    states.refillServers()
    return states
  }

  beforeEach(async () => {
    resetFakePluginState()
    websocketServer = new WS.Server({ port: WS_PORT })
    websocketServer.on('connection', (ws: WebSocket) => {
      ws.onmessage = event => {
        const data = JSON.parse(event.data)
        if (data.method === 'ping') {
          ws.send(JSON.stringify({ id: data.id, data: {} }))
        }
        if (data.method === 'getInfo') {
          ws.send(
            JSON.stringify({
              id: data.id,
              data: {
                name: 'Bitcoin',
                shortcut: 'BTC',
                decimals: 8,
                version: '0.0.0',
                bestHeight: 1,
                bestHash: '00',
                block0Hash: '00',
                testnet: false
              }
            })
          )
        }
      }
    })
    await new Promise<void>(resolve =>
      websocketServer.on('listening', () => {
        resolve()
      })
    )
  })

  afterEach(async () => {
    serverStates.stop()
    await new Promise<void>(resolve => websocketServer.close(() => resolve()))
  })

  it('probes the HTTP twin on connect and keeps an in-sync server', async () => {
    const probe = makeFakeProbe('in-sync')
    serverStates = makeProbedServerStates(probe, [
      { type: 'blockbook', uris: [HTTP_TWIN] }
    ])

    await waitFor(() => serverStates.getServerHealth(WS_URI) === 'healthy')

    expect(probe.calls).to.deep.equal([`${HTTP_TWIN}/api/`])
    expect(serverStates.getServerState(WS_URI)?.blockbook.isConnected).to.equal(
      true
    )
  })

  it('treats a failed probe as unknown and keeps the server', async () => {
    const probe = makeFakeProbe('error')
    serverStates = makeProbedServerStates(probe, [
      { type: 'blockbook', uris: [HTTP_TWIN] }
    ])

    await waitFor(() => serverStates.getServerHealth(WS_URI) === 'unknown')

    expect(probe.calls).to.have.lengthOf(1)
    expect(serverStates.getServerState(WS_URI)?.blockbook.isConnected).to.equal(
      true
    )
  })

  it('treats an unparseable probe body as unknown', async () => {
    const probe = makeFakeProbe('garbage')
    serverStates = makeProbedServerStates(probe, [
      { type: 'blockbook', uris: [HTTP_TWIN] }
    ])

    await waitFor(() => probe.calls.length > 0)
    await waitFor(() => serverStates.getServerHealth(WS_URI) === 'unknown')

    expect(serverStates.getServerState(WS_URI)?.blockbook.isConnected).to.equal(
      true
    )
  })

  it('keeps an out-of-sync server when it is the only connection', async () => {
    const probe = makeFakeProbe('behind')
    serverStates = makeProbedServerStates(probe, [
      { type: 'blockbook', uris: [HTTP_TWIN] }
    ])

    await waitFor(() => serverStates.getServerHealth(WS_URI) === 'unhealthy')
    // Give an errant drop time to happen before asserting it did not:
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(serverStates.getServerState(WS_URI)?.blockbook.isConnected).to.equal(
      true
    )
    expect(quarantined).to.deep.equal([])
  })

  describe('with a second server', () => {
    // A different host string so it maps to its own HTTP twin:
    const PEER_PORT = WS_PORT + 1
    const PEER_URI = `ws://127.0.0.1:${PEER_PORT}`
    const PEER_TWIN = `http://127.0.0.1:${PEER_PORT}`
    let peerServer: WS.Server

    beforeEach(async () => {
      peerServer = new WS.Server({ port: PEER_PORT })
      peerServer.on('connection', (ws: WebSocket) => {
        ws.onmessage = event => {
          const data = JSON.parse(event.data)
          if (data.method === 'ping') {
            ws.send(JSON.stringify({ id: data.id, data: {} }))
          }
          if (data.method === 'getInfo') {
            ws.send(
              JSON.stringify({
                id: data.id,
                data: {
                  name: 'Bitcoin',
                  shortcut: 'BTC',
                  decimals: 8,
                  version: '0.0.0',
                  bestHeight: 1,
                  bestHash: '00',
                  block0Hash: '00',
                  testnet: false
                }
              })
            )
          }
        }
      })
      await new Promise<void>(resolve =>
        peerServer.on('listening', () => {
          resolve()
        })
      )
    })

    afterEach(async () => {
      await new Promise<void>(resolve => peerServer.close(() => resolve()))
    })

    it('drops a server whose twin reports inSync false', async () => {
      const probe = makeFakeProbe('in-sync', { [HTTP_TWIN]: 'behind' })
      serverStates = makeProbedServerStates(
        probe,
        [{ type: 'blockbook', uris: [HTTP_TWIN, PEER_TWIN] }],
        new EngineEmitter(),
        [WS_URI, PEER_URI]
      )

      await waitFor(() => serverStates.getServerState(WS_URI) == null)

      expect(probe.calls).to.include(`${HTTP_TWIN}/api/`)
      expect(quarantined).to.deep.equal([WS_URI])
    })

    it('tells the engine which server it dropped', async () => {
      const probe = makeFakeProbe('in-sync', { [HTTP_TWIN]: 'behind' })
      const engineEmitter = new EngineEmitter()
      const dropped: string[] = []
      engineEmitter.on(EngineEvent.SERVER_DROPPED, (uri: string) => {
        dropped.push(uri)
      })
      serverStates = makeProbedServerStates(
        probe,
        [{ type: 'blockbook', uris: [HTTP_TWIN, PEER_TWIN] }],
        engineEmitter,
        [WS_URI, PEER_URI]
      )

      await waitFor(() => dropped.length > 0)

      expect(dropped).to.deep.equal([WS_URI])
      expect(serverStates.getServerState(WS_URI)).to.equal(undefined)
    })

    it('does not reconnect to a quarantined server on refill', async () => {
      const probe = makeFakeProbe('in-sync', { [HTTP_TWIN]: 'behind' })
      serverStates = makeProbedServerStates(
        probe,
        [{ type: 'blockbook', uris: [HTTP_TWIN, PEER_TWIN] }],
        new EngineEmitter(),
        [WS_URI, PEER_URI]
      )
      await waitFor(() => serverStates.getServerState(WS_URI) == null)
      const probesBefore = probe.calls.filter(uri => uri.startsWith(HTTP_TWIN))

      serverStates.setServerList([WS_URI])
      serverStates.refillServers()
      await new Promise(resolve => setTimeout(resolve, 200))

      expect(serverStates.getServerState(WS_URI)).to.equal(undefined)
      expect(
        probe.calls.filter(uri => uri.startsWith(HTTP_TWIN))
      ).to.deep.equal(probesBefore)
    })

    it('drops the out-of-sync server once an in-sync peer is connected', async () => {
      const probe = makeFakeProbe('in-sync', { [HTTP_TWIN]: 'behind' })
      serverStates = makeProbedServerStates(
        probe,
        [{ type: 'blockbook', uris: [HTTP_TWIN, PEER_TWIN] }],
        new EngineEmitter(),
        [WS_URI, PEER_URI]
      )

      await waitFor(() => serverStates.getServerState(WS_URI) == null)

      expect(quarantined).to.deep.equal([WS_URI])
      expect(serverStates.getServerHealth(PEER_URI)).to.equal('healthy')
      expect(
        serverStates.getServerState(PEER_URI)?.blockbook.isConnected
      ).to.equal(true)
    })

    it('counts an unprobed third-party peer as usable', async () => {
      const probe = makeFakeProbe('behind')
      serverStates = makeProbedServerStates(
        probe,
        [{ type: 'blockbook', uris: [HTTP_TWIN] }],
        new EngineEmitter(),
        [WS_URI, PEER_URI]
      )

      await waitFor(() => serverStates.getServerState(WS_URI) == null)

      expect(quarantined).to.deep.equal([WS_URI])
      expect(serverStates.getServerHealth(PEER_URI)).to.equal('unknown')
    })
  })

  it('never probes a server without an HTTP twin', async () => {
    const probe = makeFakeProbe('behind')
    serverStates = makeProbedServerStates(probe, [
      { type: 'blockbook', uris: ['https://elsewhere.test'] },
      { type: 'blockbook-nownode', uris: [HTTP_TWIN] }
    ])

    await waitFor(
      () => serverStates.getServerState(WS_URI)?.blockbook.isConnected === true
    )
    // Give a probe every chance to fire before asserting it did not:
    await new Promise(resolve => setTimeout(resolve, 200))

    expect(serverStates.getServerHealth(WS_URI)).to.equal('unknown')
    expect(probe.calls).to.have.lengthOf(0)
  })
})

describe('ServerStates health probe over time', function () {
  this.timeout(15000)

  // Separate ports from the block above so the two suites never collide.
  const A_PORT = 8558
  const B_PORT = 8559
  const A_URI = `ws://localhost:${A_PORT}`
  const B_URI = `ws://127.0.0.1:${B_PORT}`
  const A_TWIN = `http://localhost:${A_PORT}`
  const B_TWIN = `http://127.0.0.1:${B_PORT}`

  type ProbeReply = 'in-sync' | 'behind' | 'stalled-body'

  interface MutableProbe {
    calls: string[]
    replies: { [twin: string]: ProbeReply }
    fetchCors: (uri: string) => Promise<EdgeFetchResponse>
  }

  const makeMutableProbe = (replies: {
    [twin: string]: ProbeReply
  }): MutableProbe => {
    const calls: string[] = []
    return {
      calls,
      replies,
      async fetchCors(uri: string): Promise<EdgeFetchResponse> {
        calls.push(uri)
        const twin = Object.keys(replies).find(key => uri.startsWith(key))
        const reply = twin != null ? replies[twin] : 'in-sync'
        return ({
          ok: true,
          status: 200,
          json: async () =>
            reply === 'stalled-body'
              ? await new Promise(() => {})
              : { blockbook: { inSync: reply === 'in-sync' } }
        } as unknown) as EdgeFetchResponse
      }
    }
  }

  const probesTo = (probe: MutableProbe, twin: string): number =>
    probe.calls.filter(uri => uri.startsWith(twin)).length

  const makeBlockbookServer = async (port: number): Promise<WS.Server> => {
    const server = new WS.Server({ port })
    server.on('connection', (ws: WebSocket) => {
      ws.onmessage = event => {
        const data = JSON.parse(event.data)
        if (data.method === 'ping') {
          ws.send(JSON.stringify({ id: data.id, data: {} }))
        }
        if (data.method === 'getInfo') {
          ws.send(
            JSON.stringify({
              id: data.id,
              data: {
                name: 'Bitcoin',
                shortcut: 'BTC',
                decimals: 8,
                version: '0.0.0',
                bestHeight: 1,
                bestHash: '00',
                block0Hash: '00',
                testnet: false
              }
            })
          )
        }
      }
    })
    await new Promise<void>(resolve =>
      server.on('listening', () => {
        resolve()
      })
    )
    return server
  }

  const makeTimedServerStates = (
    probe: MutableProbe,
    options: { healthProbeMinIntervalMs?: number; walletId?: string } = {}
  ): ServerStates => {
    const pluginInfo = makeFakePluginInfo()
    pluginInfo.engineInfo.serverConfigs = [
      { type: 'blockbook', uris: [A_TWIN, B_TWIN] }
    ]
    const states = makeServerStates({
      engineEmitter: new EngineEmitter(),
      initOptions: {},
      io: { ...makeFakeIo(), fetchCors: probe.fetchCors },
      log: makeFakeLog(),
      pluginInfo,
      pluginState: fakePluginState,
      walletInfo: {
        ...fakeWalletInfo,
        id: options.walletId ?? fakeWalletInfo.id
      },
      // A keepalive every 200ms, checked every 100ms, so the probe cycle
      // runs several times within a test:
      keepAliveMs: 200,
      wakeUpMs: 100,
      healthProbeTimeoutMs: 300,
      healthProbeMinIntervalMs: options.healthProbeMinIntervalMs ?? 0
    })
    states.setPickNextTaskCB(async function* () {
      return false
    })
    states.setServerList([A_URI, B_URI])
    states.refillServers()
    return states
  }

  let serverA: WS.Server
  let serverB: WS.Server
  let serverStates: ServerStates

  beforeEach(async () => {
    resetFakePluginState()
    serverA = await makeBlockbookServer(A_PORT)
    serverB = await makeBlockbookServer(B_PORT)
  })

  afterEach(async () => {
    serverStates.stop()
    await new Promise<void>(resolve => serverA.close(() => resolve()))
    await new Promise<void>(resolve => serverB.close(() => resolve()))
  })

  it('re-probes on every keepalive', async () => {
    const probe = makeMutableProbe({})
    serverStates = makeTimedServerStates(probe)

    await waitFor(() => probesTo(probe, A_TWIN) >= 3)

    expect(serverStates.getServerHealth(A_URI)).to.equal('healthy')
    expect(serverStates.getServerHealth(B_URI)).to.equal('healthy')
  })

  it('times out a probe whose body never arrives', async () => {
    const probe = makeMutableProbe({ [A_TWIN]: 'stalled-body' })
    serverStates = makeTimedServerStates(probe)

    await waitFor(() => serverStates.getServerHealth(A_URI) === 'unknown')

    // The stalled probe must not block the next one:
    probe.replies[A_TWIN] = 'in-sync'
    await waitFor(() => serverStates.getServerHealth(A_URI) === 'healthy')
  })

  it('drops a server that falls out of sync after connecting', async () => {
    const probe = makeMutableProbe({})
    serverStates = makeTimedServerStates(probe)
    await waitFor(
      () =>
        serverStates.getServerHealth(A_URI) === 'healthy' &&
        serverStates.getServerHealth(B_URI) === 'healthy'
    )

    probe.replies[A_TWIN] = 'behind'
    await waitFor(() => serverStates.getServerState(A_URI) == null)

    expect(quarantined).to.deep.equal([A_URI])
    expect(serverStates.getServerHealth(B_URI)).to.equal('healthy')
    expect(serverStates.getServerState(B_URI)?.blockbook.isConnected).to.equal(
      true
    )
  })

  it('keeps the last leg when every server falls out of sync', async () => {
    const probe = makeMutableProbe({})
    serverStates = makeTimedServerStates(probe)
    await waitFor(
      () =>
        serverStates.getServerHealth(A_URI) === 'healthy' &&
        serverStates.getServerHealth(B_URI) === 'healthy'
    )

    // Probes answer one at a time, so whichever reports first is dropped
    // while the other still looks usable. The second then has no peer left
    // and must be kept, out of sync or not.
    probe.replies[A_TWIN] = 'behind'
    probe.replies[B_TWIN] = 'behind'
    await waitFor(() => quarantined.length === 1)
    const survivor = quarantined[0] === A_URI ? B_URI : A_URI
    await waitFor(() => serverStates.getServerHealth(survivor) === 'unhealthy')
    // Give an errant second drop time to happen before asserting it did not:
    await new Promise(resolve => setTimeout(resolve, 500))

    expect(serverStates.getServerState(survivor)).to.not.equal(undefined)
    expect(quarantined).to.have.lengthOf(1)
  })

  it('keeps only one stale leg when both servers connect out of sync', async () => {
    // Both probes are pending when the first answers, so neither server
    // sees a usable peer. Keeping both would fill every slot with stale
    // servers; one must go so the refill can look for a replacement.
    const probe = makeMutableProbe({ [A_TWIN]: 'behind', [B_TWIN]: 'behind' })
    serverStates = makeTimedServerStates(probe)

    await waitFor(() => quarantined.length === 1)
    const survivor = quarantined[0] === A_URI ? B_URI : A_URI
    await waitFor(() => serverStates.getServerHealth(survivor) === 'unhealthy')
    // Give an errant second drop time to happen before asserting it did not:
    await new Promise(resolve => setTimeout(resolve, 500))

    expect(serverStates.getServerState(survivor)).to.not.equal(undefined)
    expect(quarantined).to.have.lengthOf(1)
  })

  it('skips probes closer together than the minimum interval', async () => {
    const probe = makeMutableProbe({})
    serverStates = makeTimedServerStates(probe, {
      healthProbeMinIntervalMs: 60000
    })
    await waitFor(() => serverStates.getServerHealth(A_URI) === 'healthy')
    // Several keepalives go by:
    await new Promise(resolve => setTimeout(resolve, 700))

    expect(probesTo(probe, A_TWIN)).to.equal(1)
  })

  it('shares one probe per server between wallets', async () => {
    const probe = makeMutableProbe({})
    serverStates = makeTimedServerStates(probe, {
      healthProbeMinIntervalMs: 60000
    })
    const otherWallet = makeTimedServerStates(probe, {
      healthProbeMinIntervalMs: 60000,
      walletId: 'other-wallet-id'
    })
    try {
      await waitFor(
        () =>
          serverStates.getServerHealth(A_URI) === 'healthy' &&
          otherWallet.getServerHealth(A_URI) === 'healthy'
      )
      // Several keepalives go by in both wallets:
      await new Promise(resolve => setTimeout(resolve, 700))

      expect(probesTo(probe, A_TWIN)).to.equal(1)
      expect(otherWallet.getServerHealth(A_URI)).to.equal('healthy')
    } finally {
      otherWallet.stop()
    }
  })

  it('takes a dropped server back once it is in sync and out of quarantine', async () => {
    const probe = makeMutableProbe({ [A_TWIN]: 'behind' })
    serverStates = makeTimedServerStates(probe)
    await waitFor(() => serverStates.getServerState(A_URI) == null)
    expect(quarantined).to.deep.equal([A_URI])

    // The server recovers and its quarantine expires:
    probe.replies[A_TWIN] = 'in-sync'
    quarantined.length = 0
    serverStates.setServerList([A_URI])
    serverStates.refillServers()

    await waitFor(() => serverStates.getServerHealth(A_URI) === 'healthy')
    expect(serverStates.getServerState(A_URI)?.blockbook.isConnected).to.equal(
      true
    )
    expect(quarantined).to.deep.equal([])
  })
})
