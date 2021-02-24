import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { makeMemoryDisklet } from 'disklet'

import { makeProcessor, Processor } from '../../../../src/common/utxobased/db/makeProcessor'
import { CurrencyFormat, NetworkEnum } from '../../../../src/common/plugin/types'
import {
  BitcoinWalletToolsConfig,
  makeUtxoWalletTools
} from '../../../../src/common/utxobased/engine/makeUtxoWalletTools'
import { EventEmitter } from 'events'
import { expect } from 'chai'

chai.should()
chai.use(chaiAsPromised)

describe('Processor', function() {
  const storage = {}
  const disklet = makeMemoryDisklet(storage)
  const emitter = new EventEmitter() as any
  let processor: Processor

  const format: CurrencyFormat = 'bip44'
  const walletToolsConfig: BitcoinWalletToolsConfig = {
    keys: {
      bitcoinKey: 'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb',
      format,
      coinType: 0
    },
    coin: 'bitcoin',
    network: NetworkEnum.Mainnet
  }
  const walletTools = makeUtxoWalletTools(walletToolsConfig)

  before(async () => {
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
})
