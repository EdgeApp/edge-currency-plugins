import * as chai from 'chai'
import { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { makeMemoryDisklet } from 'disklet'
import { EventEmitter } from 'events'

import {
  makeProcessor,
  Processor
} from '../../../../src/common/utxobased/db/makeProcessor'

chai.should()
chai.use(chaiAsPromised)

describe('Processor', function () {
  const storage = {}
  const disklet = makeMemoryDisklet(storage)
  const emitter = new EventEmitter() as any
  let processor: Processor

  beforeEach(async () => {
    processor = await makeProcessor({ disklet, emitter })
  })

  it('insert tx id by confirmation', async function () {
    const noEntry = await processor.fetchTxIdsByBlockHeight(0)
    expect(noEntry).to.eql([])
    await processor.removeTxIdByBlockHeight(0, 'test')
    await processor.insertTxIdByBlockHeight(0, 'this')
    await processor.insertTxIdByBlockHeight(0, 'that')
    await processor.insertTxIdByBlockHeight(1, 'whatever')
    let zeroConf = await processor.fetchTxIdsByBlockHeight(0)
    const oneConf = await processor.fetchTxIdsByBlockHeight(1)
    const allConf = await processor.fetchTxIdsByBlockHeight(0, 1)
    expect(zeroConf).to.eql(['that', 'this'])
    expect(oneConf[0]).to.eql('whatever')
    expect(allConf).to.eql(['that', 'this', 'whatever'])
    await processor.removeTxIdByBlockHeight(0, 'this')
    zeroConf = await processor.fetchTxIdsByBlockHeight(0)
    expect(zeroConf).to.eql(['that'])
  })

  it('test reset', async () => {
    await processor.saveAddress({
      lastQuery: 0,
      lastTouched: 0,
      used: false,
      balance: '0',
      scriptPubkey: 'justatest',
      networkQueryVal: 0,
      path: {
        format: 'bip32',
        changeIndex: 0,
        addressIndex: 0
      }
    })
    const testAddress = await processor.fetchAddressByScriptPubkey('justatest')
    let lastQuery: number
    if (testAddress != null) {
      lastQuery = testAddress.lastQuery
    } else {
      lastQuery = 0
    }
    expect(testAddress).to.eql({
      lastQuery,
      lastTouched: 0,
      used: false,
      balance: '0',
      scriptPubkey: 'justatest',
      networkQueryVal: 0,
      path: { format: 'bip32', changeIndex: 0, addressIndex: 0 }
    })
    await processor.clearAll()
    const emptyAddress = await processor.fetchAddressByScriptPubkey('justatest')
    expect(emptyAddress).to.equal(undefined)
  })
})
