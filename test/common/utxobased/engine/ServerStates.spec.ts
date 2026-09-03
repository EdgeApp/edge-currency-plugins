import { expect } from 'chai'
import { makeFakeIo } from 'edge-core-js'
import {
  EdgeFetchOptions,
  EdgeFetchResponse,
  EdgeTransaction
} from 'edge-core-js/types'
import WS from 'ws'

import { EngineEmitter } from '../../../../src/common/plugin/EngineEmitter'
import { PluginState } from '../../../../src/common/plugin/PluginState'
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

const fakePluginState = ({
  serverScoreUp: () => {},
  serverScoreDown: () => {},
  getLocalServers: () => []
} as unknown) as PluginState

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
