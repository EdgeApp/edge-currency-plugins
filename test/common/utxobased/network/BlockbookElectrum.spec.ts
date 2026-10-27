import { expect } from 'chai'
import { EdgeTransaction } from 'edge-core-js/types'
import WS from 'ws'

import {
  EngineEmitter,
  EngineEvent
} from '../../../../src/common/plugin/EngineEmitter'
import { info as bitcoin } from '../../../../src/common/utxobased/info/bitcoin'
import { Blockbook } from '../../../../src/common/utxobased/network/Blockbook'
import { makeBlockbookElectrum } from '../../../../src/common/utxobased/network/BlockbookElectrum'
import Deferred from '../../../../src/common/utxobased/network/Deferred'
import { pingMessage } from '../../../../src/common/utxobased/network/electrumApi'
import { WsTask } from '../../../../src/common/utxobased/network/Socket'
import { SocketEmitter } from '../../../../src/common/utxobased/network/SocketEmitter'
import { makeFakeLog } from '../../../utils'

const SIGNED_TX =
  '02000000000101955c9281f8853c0b051e1c1bfe5c90072ca59208676eba7a199191eacbdabd450000000000fdffffff01443217000000000017a914f01eb338a6c45ce9986d0528898c5fd747bb97db8700000000'
const TXID = '512ae0bea5252fbcde7783dbbbf6c505c040b7a138645987922489f8d84ac6de'
// Bitcoin's genesis block header and hash:
const HEADER =
  '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c'
const HEADER_HASH =
  '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f'

const transaction = ({
  txid: TXID,
  signedTx: SIGNED_TX
} as unknown) as EdgeTransaction

interface ElectrumRequest {
  id: string
  method: string
  params: unknown
}

describe('BlockbookElectrum with a dummy Electrum server', function () {
  let websocketServer: WS.Server
  let client: WebSocket
  let blockbook: Blockbook
  let engineEmitter: EngineEmitter
  let requests: ElectrumRequest[]
  // Builds the JSON-RPC answer body (`result` or `error`) for a request:
  let answer: (request: ElectrumRequest) => object

  beforeEach(async () => {
    requests = []
    answer = () => ({ result: null })
    engineEmitter = new EngineEmitter()
    websocketServer = new WS.Server({ port: 8556 })
    websocketServer.on('connection', (ws: WebSocket) => {
      client = ws
      ws.onmessage = event => {
        const request: ElectrumRequest = JSON.parse(event.data)
        requests.push(request)
        // Fulcrum rejects named (object) params for server.ping:
        const body =
          request.method !== 'server.ping'
            ? answer(request)
            : Array.isArray(request.params)
            ? { result: null }
            : {
                error: {
                  code: -32602,
                  message: 'Named params are not supported for this method'
                }
              }
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: request.id, ...body }))
      }
    })

    async function* taskGeneratorFn(
      _uri: string
    ): AsyncGenerator<WsTask<unknown> | boolean> {
      return false
    }

    blockbook = makeBlockbookElectrum({
      connectionUri: 'electrumws://localhost:8556',
      engineEmitter,
      initOptions: {},
      log: makeFakeLog(),
      pluginInfo: bitcoin,
      socketEmitter: new SocketEmitter(),
      taskGeneratorFn,
      walletId: ''
    })
    await blockbook.connect()
  })

  afterEach(async () => {
    await blockbook.disconnect()
    websocketServer.close()
  })

  it('pings with positional params', async () => {
    await blockbook.promisifyWsMessage(pingMessage())

    // The socket's own keepalive may have pinged too:
    const pings = requests.filter(request => request.method === 'server.ping')
    expect(pings).to.not.have.length(0)
    for (const ping of pings) expect(ping.params).to.deep.equal([])
  })

  it('fetches the block height with blockchain.headers.subscribe', async () => {
    answer = () => ({ result: { height: 974024, hex: HEADER } })

    const info = await blockbook.fetchInfo()

    expect(info.bestHeight).to.equal(974024)
    expect(info.bestHash).to.equal(HEADER_HASH)
  })

  it('reports each new block the server announces', async () => {
    answer = () => ({ result: { height: 974024, hex: HEADER } })
    const subscribed = new Deferred<unknown>()
    blockbook.watchBlocks(subscribed)
    await subscribed.promise

    const announcedHeight = new Promise<number>(resolve => {
      engineEmitter.on(EngineEvent.BLOCK_HEIGHT_CHANGED, (_uri, height) =>
        resolve(height)
      )
    })
    client.send(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'blockchain.headers.subscribe',
        params: [{ height: 974025, hex: HEADER }]
      })
    )

    expect(await announcedHeight).to.equal(974025)
    // The notification leaves the connection usable:
    await blockbook.promisifyWsMessage(pingMessage())
  })

  it('skips new blocks announced before blocks are watched', async () => {
    answer = () => ({ result: { height: 974024, hex: HEADER } })
    // fetchInfo subscribes the connection to new blocks server-side:
    await blockbook.fetchInfo()

    client.send(
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'blockchain.headers.subscribe',
        params: [{ height: 974025, hex: HEADER }]
      })
    )

    // The announcement leaves the connection usable:
    await blockbook.promisifyWsMessage(pingMessage())
  })

  it('broadcasts with blockchain.transaction.broadcast', async () => {
    answer = () => ({ result: TXID })

    const response = await blockbook.broadcastTx(transaction)

    expect(response).to.deep.equal({ result: TXID })
    const broadcasts = requests.filter(
      request => request.method === 'blockchain.transaction.broadcast'
    )
    expect(broadcasts.map(request => request.params)).to.deep.equal([
      [SIGNED_TX]
    ])
  })

  it('rejects with the reason the server gives', async () => {
    answer = () => ({
      error: {
        code: 1,
        message: 'the transaction was rejected by network rules.'
      }
    })

    let error: unknown
    try {
      await blockbook.broadcastTx(transaction)
    } catch (e) {
      error = e
    }

    expect(error).to.be.instanceOf(Error)
    expect((error as Error).message).to.equal(
      'the transaction was rejected by network rules.'
    )
  })
})
