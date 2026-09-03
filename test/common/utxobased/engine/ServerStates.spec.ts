import { expect } from 'chai'
import { makeFakeIo } from 'edge-core-js'
import {
  EdgeFetchOptions,
  EdgeFetchResponse,
  EdgeTransaction
} from 'edge-core-js/types'

import { EngineEmitter } from '../../../../src/common/plugin/EngineEmitter'
import { PluginState } from '../../../../src/common/plugin/PluginState'
import { ServerConfig } from '../../../../src/common/plugin/types'
import {
  makeServerStates,
  ServerStates
} from '../../../../src/common/utxobased/engine/ServerStates'
import { SafeWalletInfo } from '../../../../src/common/utxobased/keymanager/cleaners'
import { makeFakeLog, makeFakePluginInfo } from '../../../utils'

const TXID = 'deadbeef'

type HttpBehavior = 'ok' | 'fail'

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
    walletInfo: fakeWalletInfo
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

  it('sends the api-key header only to NOWNodes servers', async () => {
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

    await serverStates.broadcastTx(transaction)
    await waitFor(() => http.calls.length === 2)

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
})
