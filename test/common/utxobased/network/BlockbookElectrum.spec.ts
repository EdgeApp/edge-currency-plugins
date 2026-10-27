import { expect } from 'chai'
import { EdgeTransaction } from 'edge-core-js/types'
import WS from 'ws'

import {
  EngineEmitter,
  EngineEvent
} from '../../../../src/common/plugin/EngineEmitter'
import { info as bitcoin } from '../../../../src/common/utxobased/info/bitcoin'
import { Blockbook } from '../../../../src/common/utxobased/network/Blockbook'
import {
  BlockbookTransaction,
  transactionMessage
} from '../../../../src/common/utxobased/network/blockbookApi'
import { makeBlockbookElectrum } from '../../../../src/common/utxobased/network/BlockbookElectrum'
import Deferred from '../../../../src/common/utxobased/network/Deferred'
import { pingMessage } from '../../../../src/common/utxobased/network/electrumApi'
import {
  WsTask,
  WsTaskAsyncGenerator
} from '../../../../src/common/utxobased/network/Socket'
import { SocketEmitter } from '../../../../src/common/utxobased/network/SocketEmitter'
import { makeFakeLog } from '../../../utils'

const SIGNED_TX =
  '02000000000101955c9281f8853c0b051e1c1bfe5c90072ca59208676eba7a199191eacbdabd450000000000fdffffff01443217000000000017a914f01eb338a6c45ce9986d0528898c5fd747bb97db8700000000'
const TXID = '512ae0bea5252fbcde7783dbbbf6c505c040b7a138645987922489f8d84ac6de'
// The same transaction without a witness, which leaves its txid unchanged:
const RAW_TX =
  '0200000001955c9281f8853c0b051e1c1bfe5c90072ca59208676eba7a199191eacbdabd450000000000fdffffff01443217000000000017a914f01eb338a6c45ce9986d0528898c5fd747bb97db87ff64cd1d'
// The same input, paying a P2PKH script ahead of the same P2SH script:
const TWO_OUTPUT_TX =
  '0200000001955c9281f8853c0b051e1c1bfe5c90072ca59208676eba7a199191eacbdabd450000000000fdffffff02a0860100000000001976a914000000000000000000000000000000000000000088aca4ab15000000000017a914f01eb338a6c45ce9986d0528898c5fd747bb97db87ff64cd1d'
const TWO_OUTPUT_TXID =
  '65a3e1649cb1998375048c9a142f41ac5046eb30a4fc89d9a79fe1501cfdb765'
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
  // Engine tasks for the socket to pull, each settled with what the task
  // receives back:
  let queuedTasks: Array<{
    task: WsTask<unknown>
    settled: Deferred<unknown>
  }>

  // The socket pulls tasks after each response, so a ping wakes it:
  const runTask = async (task: WsTask<unknown>): Promise<unknown> => {
    const settled = new Deferred<unknown>()
    queuedTasks.push({ task, settled })
    await blockbook.promisifyWsMessage(pingMessage())
    return await settled.promise
  }

  const answerTransaction = (
    history: object
  ): ((request: ElectrumRequest) => object) => request =>
    request.method === 'blockchain.transaction.get'
      ? { result: RAW_TX }
      : request.method === 'blockchain.scripthash.get_history'
      ? history
      : { result: null }

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

    queuedTasks = []
    async function* taskGeneratorFn(
      _uri: string
    ): WsTaskAsyncGenerator<unknown> {
      const queued = queuedTasks.shift()
      if (queued == null) return false
      try {
        queued.settled.resolve(yield queued.task)
      } catch (error: unknown) {
        queued.settled.reject(error)
      }
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

  it('fetches transactions with blockchain.transaction.get', async () => {
    answer = answerTransaction({ result: [{ tx_hash: TXID, height: 974000 }] })

    const response = (await runTask(
      transactionMessage(TXID)
    )) as BlockbookTransaction

    expect(response.txid).to.equal(TXID)
    expect(response.hex).to.equal(RAW_TX)
    expect(response.blockHeight).to.equal(974000)
    expect(
      response.vin.map(({ n, sequence, txid, vout }) => ({
        n,
        sequence,
        txid,
        vout
      }))
    ).to.deep.equal([
      {
        n: 0,
        sequence: 0xfffffffd,
        txid:
          '45bddacbea9191197aba6e670892a52c07905cfe1b1c1e050b3c85f881925c95',
        vout: 0
      }
    ])
    expect(response.vout).to.deep.equal([
      {
        n: 0,
        value: '1520196',
        addresses: [],
        hex: 'a914f01eb338a6c45ce9986d0528898c5fd747bb97db87'
      }
    ])
    // The height comes from the history of the script the transaction pays:
    const histories = requests.filter(
      request => request.method === 'blockchain.scripthash.get_history'
    )
    expect(histories.map(request => request.params)).to.deep.equal([
      ['28ff48a12b396e7cdd686b4b51562f5f380e2083b5379b1dc71de9e05f4013e7']
    ])
  })

  it('reads the height from the next paid script after a refusal', async () => {
    let histories = 0
    answer = request =>
      request.method === 'blockchain.transaction.get'
        ? { result: TWO_OUTPUT_TX }
        : request.method !== 'blockchain.scripthash.get_history'
        ? { result: null }
        : histories++ === 0
        ? { error: { code: 1, message: 'history too large' } }
        : { result: [{ tx_hash: TWO_OUTPUT_TXID, height: 974000 }] }

    const response = (await runTask(
      transactionMessage(TWO_OUTPUT_TXID)
    )) as BlockbookTransaction

    expect(response.blockHeight).to.equal(974000)
    expect(histories).to.equal(2)
  })

  it('fails the task when no history places the transaction', async () => {
    answer = answerTransaction({
      error: { code: 1, message: 'history too large' }
    })

    let error: unknown
    try {
      await runTask(transactionMessage(TXID))
    } catch (e) {
      error = e
    }

    expect(error).to.be.instanceOf(Error)
    expect((error as Error).message).to.equal('history too large')
  })

  it('hands failed requests to the task that made them', async () => {
    answer = () => ({ error: { code: 2, message: 'missing transaction' } })

    let error: unknown
    try {
      await runTask(transactionMessage(TXID))
    } catch (e) {
      error = e
    }

    expect(error).to.be.instanceOf(Error)
    expect((error as Error).message).to.equal('missing transaction')
  })

  it('rejects tasks it cannot translate', async () => {
    let error: unknown
    try {
      await runTask({ method: 'getTransactionSpecific', params: {} })
    } catch (e) {
      error = e
    }

    expect(error).to.be.instanceOf(Error)
    expect((error as Error).message).to.equal(
      'getTransactionSpecific not supported for Electrum connections'
    )
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
