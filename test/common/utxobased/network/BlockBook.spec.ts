import * as chai from 'chai'

import { IBlockBook, makeBlockBook } from '../../../../src/common/utxobased/network/BlockBook'

chai.should()

describe('BlockBook', function() {
  this.timeout(10000)

  const satoshiAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
  let blockBook: IBlockBook

  beforeEach(async () => {
    blockBook = makeBlockBook()
    await blockBook.connect()
  })

  afterEach(() => {
    blockBook.disconnect()
  })

  describe('connect', function() {
    it('should connect to the BlockBook websocket API', async function() {
      blockBook.isConnected.should.be.true
    })
  })

  describe('disconnect', function() {
    it('should disconnect from the BlockBook API', async function() {
      blockBook.isConnected.should.be.true
      await blockBook.disconnect()
      blockBook.isConnected.should.be.false
    })
  })

  describe('fetchBlock', function() {
    it('should fetch the most recent block without a specified height', async function() {
      const block = await blockBook.fetchBlock()
      chai.expect(block).to.exist
    })
    it('should fetch a block for a specified height', async function() {
      const height = 12345
      const block = await blockBook.fetchBlock(height)
      block.height.should.equal(height)
    })
  })

  describe('fetchAddress', function() {
    it('should fetch basic address information', async function() {
      const info = await blockBook.fetchAddress(satoshiAddress)

      info.should.have.property('address', satoshiAddress)
      info.should.have.property('balance')
      info.should.have.property('totalReceived')
      info.should.have.property('totalSent')
      info.should.have.property('txs')
      info.should.have.property('unconfirmedBalance')
      info.should.have.property('unconfirmedTxs')
    })
    it('should fetch address information with tx ids', async function() {
      const info = await blockBook.fetchAddress(satoshiAddress, { details: 'txids' })

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
    it('should fetch address information with txs', async function() {
      const info = await blockBook.fetchAddress(satoshiAddress, { details: 'txs' })

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

  describe('fetchAddressUtxos', function() {
    it('should fetch an address UTXOS', async function() {
      const utxos = await blockBook.fetchAddressUtxos(satoshiAddress)

      utxos.length.should.be.greaterThan(0)
      utxos[0].should.have.property('txid')
      utxos[0].should.have.property('vout')
      utxos[0].should.have.property('value')
    })
  })

  describe('fetchTransaction', function() {
    const satoshiHash = '3ed86f1b0a0a6fe180195bc1f93fd9d0801aea8c8ad5018de82c026dc21e2b15'
    it('should fetch details from a transaction hash', async function() {
      const tx = await blockBook.fetchTransaction(satoshiHash)

      tx.txid.should.equal(satoshiHash)
      tx.fees.should.equal('226')
      tx.blockHeight.should.equal(651329)
      tx.vin[0].value.should.equal('97373')
      tx.vout[1].value.should.equal('95000')
      tx.should.have.property('confirmations')
      tx.should.have.property('blockTime')
    })
  })
})