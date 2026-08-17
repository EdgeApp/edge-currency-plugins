import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Disklet, makeMemoryDisklet } from 'disklet'
import { MemoryStorage } from 'disklet/lib/src/backends/memory'
import { EdgeLog } from 'edge-core-js/types'

import {
  EngineEmitter,
  EngineEvent
} from '../../../src/common/plugin/EngineEmitter'
import { makeMetadata, Metadata } from '../../../src/common/plugin/Metadata'
import { all } from '../../../src/common/utxobased/info/all'
import { makeFakeLog } from '../../utils'

chai.should()
chai.use(chaiAsPromised)

const wait = async (seconds: number): Promise<void> =>
  await new Promise(resolve => setTimeout(resolve, seconds * 1000))

describe('makeMetadata', () => {
  const memory: MemoryStorage = {}
  let disklet: Disklet
  let metadata: Metadata
  const log: EdgeLog = makeFakeLog()
  const emitter = new EngineEmitter()

  before(async () => {
    disklet = makeMemoryDisklet(memory)
    metadata = await makeMetadata({
      disklet,
      emitter,
      log
    })
  })

  describe('block height update', () => {
    it('should only ever increase the block height', async function () {
      this.timeout(3000)

      metadata.state.lastSeenBlockHeight.should.eql(0)

      emitter.emit(EngineEvent.BLOCK_HEIGHT_CHANGED, '', 10)
      await wait(1)
      metadata.state.lastSeenBlockHeight.should.eql(10)

      emitter.emit(EngineEvent.BLOCK_HEIGHT_CHANGED, '', 5)
      await wait(1)
      metadata.state.lastSeenBlockHeight.should.eql(10)
    })
  })
})

describe('currency metadata', () => {
  it('keeps ECX distinct from XEC', () => {
    const ecash = all.find(info => info.currencyInfo.pluginId === 'ecash')
    const ecashcom = all.find(info => info.currencyInfo.pluginId === 'ecashcom')

    if (ecash == null || ecashcom == null) {
      throw new Error('Missing eCash plugin metadata')
    }

    ecash.currencyInfo.walletType.should.equal('wallet:ecash')
    ecash.currencyInfo.currencyCode.should.equal('XEC')
    ecashcom.currencyInfo.walletType.should.equal('wallet:ecashcom')
    ecashcom.currencyInfo.currencyCode.should.equal('ECX')
    ecashcom.coinInfo.coinType.should.equal(0)
    ecashcom.coinInfo.prefixes.pubkeyHash.should.deep.equal([0x00])
    ecashcom.coinInfo.prefixes.scriptHash.should.deep.equal([0x05])
    ecashcom.coinInfo.prefixes.bech32?.should.deep.equal(['bc'])
  })

  it('has unique plugin IDs and wallet types', () => {
    const pluginIds = all.map(info => info.currencyInfo.pluginId)
    const walletTypes = all.map(info => info.currencyInfo.walletType)

    new Set(pluginIds).size.should.equal(pluginIds.length)
    new Set(walletTypes).size.should.equal(walletTypes.length)
  })
})
