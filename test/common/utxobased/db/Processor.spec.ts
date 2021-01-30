import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { makeMemoryDisklet } from 'disklet'

import { makeProcessor, Processor } from '../../../../src/common/utxobased/db/Processor'
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
    const noEntry = await processor.fetchTxIdsByConfirmations(0)
    expect(noEntry).to.equal(undefined)
    await processor.insertTxIdByConfirmations(0, 'this')
    await processor.insertTxIdByConfirmations(0, 'that')
    await processor.insertTxIdByConfirmations(1, 'this')
    let zeroConf = await processor.fetchTxIdsByConfirmations(0)
    const oneConf = await processor.fetchTxIdsByConfirmations(1)
    expect(zeroConf[0]).to.equal('this')
    expect(zeroConf[1]).to.equal('that')
    expect(oneConf[0]).to.equal('this')
    await processor.removeTxIdByConfirmations(0, 'this')
    zeroConf = await processor.fetchTxIdsByConfirmations(0)
    expect(zeroConf[0]).to.equal('that')
  })
})
