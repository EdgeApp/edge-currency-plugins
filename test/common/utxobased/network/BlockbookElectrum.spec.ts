import { expect } from 'chai'
import { EdgeTransaction } from 'edge-core-js/types'
import WS from 'ws'

import { EngineEmitter } from '../../../../src/common/plugin/EngineEmitter'
import { info as bitcoin } from '../../../../src/common/utxobased/info/bitcoin'
import { Blockbook } from '../../../../src/common/utxobased/network/Blockbook'
import { makeBlockbookElectrum } from '../../../../src/common/utxobased/network/BlockbookElectrum'
import { WsTask } from '../../../../src/common/utxobased/network/Socket'
import { SocketEmitter } from '../../../../src/common/utxobased/network/SocketEmitter'
import { makeFakeLog } from '../../../utils'

const SIGNED_TX =
  '02000000000101955c9281f8853c0b051e1c1bfe5c90072ca59208676eba7a199191eacbdabd450000000000fdffffff01443217000000000017a914f01eb338a6c45ce9986d0528898c5fd747bb97db8700000000'
const TXID = '512ae0bea5252fbcde7783dbbbf6c505c040b7a138645987922489f8d84ac6de'

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
  let blockbook: Blockbook
  let requests: ElectrumRequest[]
  // Builds the JSON-RPC answer body (`result` or `error`) for a request:
  let answer: (request: ElectrumRequest) => object

  beforeEach(async () => {
    requests = []
    answer = () => ({ result: null })
    websocketServer = new WS.Server({ port: 8556 })
    websocketServer.on('connection', (ws: WebSocket) => {
      ws.onmessage = event => {
        const request: ElectrumRequest = JSON.parse(event.data)
        requests.push(request)
        const body =
          request.method === 'server.ping' ? { result: null } : answer(request)
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
      engineEmitter: new EngineEmitter(),
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
