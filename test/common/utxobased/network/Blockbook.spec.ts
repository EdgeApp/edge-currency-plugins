/* eslint-disable @typescript-eslint/no-unused-expressions */
import * as chai from 'chai'
import { expect } from 'chai'
import WS from 'ws'

import {
  EngineEmitter,
  EngineEvent
} from '../../../../src/common/plugin/EngineEmitter'
import {
  Blockbook,
  makeBlockbook
} from '../../../../src/common/utxobased/network/Blockbook'
import { SubscribeAddressResponse } from '../../../../src/common/utxobased/network/blockbookApi'
import Deferred from '../../../../src/common/utxobased/network/Deferred'
import { WsTask } from '../../../../src/common/utxobased/network/Socket'
import {
  SocketEmitter,
  SocketEvent
} from '../../../../src/common/utxobased/network/SocketEmitter'
import { makeFakeLog } from '../../../utils'

chai.should()

describe('Blockbook notifications tests with dummy server', function () {
  let websocketServer: WS.Server
  let blockbook: Blockbook
  let websocketClient: WebSocket
  let engineEmitter: EngineEmitter

  beforeEach(async () => {
    websocketServer = new WS.Server({ port: 8555 })
    websocketServer.on('connection', (ws: WebSocket) => {
      websocketClient = ws
      websocketClient.onmessage = event => {
        const data = JSON.parse(event.data)
        switch (data.method) {
          case 'ping':
            websocketClient.send(
              JSON.stringify({
                id: data.id,
                data: {}
              })
            )
            break
          case 'subscribeAddress':
          case 'subscribeNewBlock':
            websocketClient.send(
              JSON.stringify({
                id: data.id,
                data: { subscribed: true }
              })
            )
            break
        }
      }
    })
    websocketServer.on('error', error => {
      console.log(error)
    })
    engineEmitter = new EngineEmitter()
    const socketEmitter = new SocketEmitter()

    const log = makeFakeLog()

    const onQueueSpaceCB = async (
      _uri: string
    ): Promise<WsTask<unknown> | undefined> => {
      return
    }

    let open = false
    socketEmitter.on(SocketEvent.CONNECTION_OPEN, (_uri: string) => {
      open = true
    })

    blockbook = makeBlockbook({
      connectionUri: 'ws://localhost:8555',
      engineEmitter,
      log,
      onQueueSpaceCB,
      socketEmitter,
      walletId: ''
    })
    await blockbook.connect()
    blockbook.isConnected.should.be.true
    open.should.be.true
  })

  afterEach(async () => {
    await blockbook.disconnect()
    blockbook.isConnected.should.be.false
    websocketServer.close()
  })

  it('Test Blockbook watch address and watch block events', async () => {
    let test = false
    test.should.be.false

    engineEmitter.on(
      EngineEvent.BLOCK_HEIGHT_CHANGED,
      (_uri: string, _blockHeight: number) => {
        test = true
      }
    )

    blockbook.watchBlocks(new Deferred<unknown>())
    websocketClient.send(
      '{"id":"subscribeNewBlock","data":{"height":1916453,"hash":"0000000000000e0444fa7c1540a96e5658898a59733311d08f01292e114e8d5b"}}'
    )
    await new Promise(resolve => setTimeout(resolve, 100))
    test.should.be.true

    test = false
    websocketClient.send(
      '{"id":"subscribeNewBlock","data":{"height":1916453,"hash":"0000000000000e0444fa7c1540a96e5658898a59733311d08f01292e114e8d5b"}}'
    )
    await new Promise(resolve => setTimeout(resolve, 100))
    test.should.be.true
    test = false

    test.should.be.false

    engineEmitter.on(
      EngineEvent.NEW_ADDRESS_TRANSACTION,
      (_uri: string, _newTx: SubscribeAddressResponse) => {
        test = true
      }
    )
    blockbook.watchAddresses(
      ['tb1q8uc93239etekcywh2l0t7aklxwywhaw0xlexld'],
      new Deferred<unknown>()
    )
    websocketClient.send(
      '{"id":"subscribeAddresses","data":{"address":"tb1q8uc93239etekcywh2l0t7aklxwywhaw0xlexld","tx":{"txid":"cfd4c31709bd48026c6c1027c47cef305c47947d73248129fee3f4b63ca1af43","version":1,"vin":[{"txid":"e0965d6df36a4ba811fb29819beeae0203fe68e48143344908146a58c5333996","vout":1,"sequence":4294967295,"n":0,"addresses":["tb1qrps90para9l48lydp2xga0p5yyckuj5l7vsu6t"],"isAddress":true,"value":"81581580"}],"vout":[{"value":"100000","n":0,"hex":"00143f3058aa25caf36c11d757debf76df3388ebf5cf","addresses":["tb1q8uc93239etekcywh2l0t7aklxwywhaw0xlexld"],"isAddress":true},{"value":"81463900","n":1,"hex":"0014be4df3d4535bd56f4d35dc1ffdb58408b084ebaa","addresses":["tb1qhexl84znt02k7nf4ms0lmdvypzcgf6a2c9zduk"],"isAddress":true}],"blockHeight":0,"confirmations":0,"blockTime":1612198107,"value":"81563900","valueIn":"81581580","fees":"17680","hex":"01000000000101963933c5586a140849344381e468fe0302aeee9b8129fb11a84b6af36d5d96e00100000000ffffffff02a0860100000000001600143f3058aa25caf36c11d757debf76df3388ebf5cf5c0adb0400000000160014be4df3d4535bd56f4d35dc1ffdb58408b084ebaa0247304402201e7f25a03517d932b2df5d099da597132047f5b7bb5cff43252ba0113fc161d2022003b80682bf7f32e685b21a6f28abc494dcc73c34bc62233f918b54afbbaca36c0121029eea7dac242382a543f6288023ac5a62064bea27349d25fc93180b14d5dd117400000000"}}}'
    )
    await new Promise(resolve => setTimeout(resolve, 100))
    test.should.be.true
    test = false
    websocketClient.send(
      '{"id":"subscribeAddresses","data":{"address":"tb1q8uc93239etekcywh2l0t7aklxwywhaw0xlexld","tx":{"txid":"cfd4c31709bd48026c6c1027c47cef305c47947d73248129fee3f4b63ca1af43","version":1,"vin":[{"txid":"e0965d6df36a4ba811fb29819beeae0203fe68e48143344908146a58c5333996","vout":1,"sequence":4294967295,"n":0,"addresses":["tb1qrps90para9l48lydp2xga0p5yyckuj5l7vsu6t"],"isAddress":true,"value":"81581580"}],"vout":[{"value":"100000","n":0,"hex":"00143f3058aa25caf36c11d757debf76df3388ebf5cf","addresses":["tb1q8uc93239etekcywh2l0t7aklxwywhaw0xlexld"],"isAddress":true},{"value":"81463900","n":1,"hex":"0014be4df3d4535bd56f4d35dc1ffdb58408b084ebaa","addresses":["tb1qhexl84znt02k7nf4ms0lmdvypzcgf6a2c9zduk"],"isAddress":true}],"blockHeight":0,"confirmations":0,"blockTime":1612198107,"value":"81563900","valueIn":"81581580","fees":"17680","hex":"01000000000101963933c5586a140849344381e468fe0302aeee9b8129fb11a84b6af36d5d96e00100000000ffffffff02a0860100000000001600143f3058aa25caf36c11d757debf76df3388ebf5cf5c0adb0400000000160014be4df3d4535bd56f4d35dc1ffdb58408b084ebaa0247304402201e7f25a03517d932b2df5d099da597132047f5b7bb5cff43252ba0113fc161d2022003b80682bf7f32e685b21a6f28abc494dcc73c34bc62233f918b54afbbaca36c0121029eea7dac242382a543f6288023ac5a62064bea27349d25fc93180b14d5dd117400000000"}}}'
    )
    await new Promise(resolve => setTimeout(resolve, 100))
    test.should.be.true
  })
})

describe('Blockbook', function () {
  this.timeout(10000)

  const satoshiAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
  const engineEmitter = new EngineEmitter()
  const socketEmitter = new SocketEmitter()

  const log = makeFakeLog()

  let blockbook: Blockbook

  const onQueueSpaceCB = async (
    _uri: string
  ): Promise<WsTask<unknown> | undefined> => {
    return
  }

  beforeEach(async () => {
    blockbook = makeBlockbook({
      connectionUri: 'wss://btc1.trezor.io/websocket',
      engineEmitter,
      log,
      onQueueSpaceCB,
      socketEmitter,
      walletId: ''
    })
    await blockbook.connect()
  })

  afterEach(async () => {
    await blockbook.disconnect()
  })

  describe('connect', function () {
    it('should connect to the Blockbook websocket API', async function () {
      blockbook.isConnected.should.be.true
    })
  })

  describe('disconnect', function () {
    it('should disconnect from the Blockbook API', async function () {
      blockbook.isConnected.should.be.true
      await blockbook.disconnect()
      blockbook.isConnected.should.be.false
    })
  })

  describe('fetchInfo', function () {
    it('should fetch the Blockbook server info', async function () {
      blockbook.isConnected.should.be.true
      const info = await blockbook.fetchInfo()
      info.should.have.keys(
        'name',
        'shortcut',
        'decimals',
        'version',
        'bestHeight',
        'bestHash',
        'block0Hash',
        'testnet',
        'backend'
      )
    })
  })

  describe('fetchAddress', function () {
    it('should fetch basic address information', async function () {
      const info = await blockbook.fetchAddress(satoshiAddress)

      info.should.have.property('address', satoshiAddress)
      info.should.have.property('balance')
      info.should.have.property('totalReceived')
      info.should.have.property('totalSent')
      info.should.have.property('txs')
      info.should.have.property('unconfirmedBalance')
      info.should.have.property('unconfirmedTxs')
    })
    it('should fetch address information with tx ids', async function () {
      const info = await blockbook.fetchAddress(satoshiAddress, {
        details: 'txids'
      })

      info.should.have.property('address', satoshiAddress)
      info.should.have.property('balance')
      info.should.have.property('totalReceived')
      info.should.have.property('totalSent')
      info.should.have.property('txs')
      info.should.have.property('unconfirmedBalance')
      info.should.have.property('unconfirmedTxs')
      info.should.have.property('page')
      info.should.have.property('totalPages')
      info.should.have.property('itemsOnPage')
      info.should.have.property('txids')
    })
    it('should fetch address information with txs', async function () {
      const info = await blockbook.fetchAddress(satoshiAddress, {
        details: 'txs'
      })

      info.should.have.property('address', satoshiAddress)
      info.should.have.property('balance')
      info.should.have.property('totalReceived')
      info.should.have.property('totalSent')
      info.should.have.property('txs')
      info.should.have.property('unconfirmedBalance')
      info.should.have.property('unconfirmedTxs')
      info.should.have.property('page')
      info.should.have.property('totalPages')
      info.should.have.property('itemsOnPage')
      info.should.have.property('transactions')
    })
  })

  describe('fetchAddressUtxos', function () {
    it('should fetch an address UTXOS', async function () {
      const utxos = await blockbook.fetchAddressUtxos(satoshiAddress)

      utxos.length.should.be.greaterThan(0)
      utxos[0].should.have.property('txid')
      utxos[0].should.have.property('vout')
      utxos[0].should.have.property('value')
    })
  })

  describe('fetchTransaction', function () {
    const satoshiHash =
      '3ed86f1b0a0a6fe180195bc1f93fd9d0801aea8c8ad5018de82c026dc21e2b15'
    it('should fetch details from a transaction hash', async function () {
      const tx = await blockbook.fetchTransaction(satoshiHash)

      tx.txid.should.equal(satoshiHash)
      tx.fees.should.equal('226')
      tx.blockHeight.should.equal(651329)
      tx.vin[0].value.should.equal('97373')
      tx.vin[0].txid.should.equal(
        'fac5994d454817db2daec796cfa79cce670a372e7505fdef2a259289d5df0814'
      )
      expect(tx.vin[0].sequence).to.equal(2147483648)
      tx.vin[0].n.should.equal(0)
      tx.vin[0].addresses.should.eqls([
        'bc1qg6lwu6c8yqhhw7rrq69akknepxcft09agkkuqv'
      ])
      tx.vin[0].isAddress.should.equal(true)
      tx.vin[0].value.should.equal('97373')

      tx.vout[1].value.should.equal('95000')
      tx.should.have.property('confirmations')
      tx.should.have.property('blockTime')
    })
  })
})
