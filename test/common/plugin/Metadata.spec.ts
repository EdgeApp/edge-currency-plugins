import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { makeMemoryTxDatabase } from 'edge-core-js'
import { EdgeLog } from 'edge-core-js/types'

import {
  EngineEmitter,
  EngineEvent
} from '../../../src/common/plugin/EngineEmitter'
import { makeMetadata, Metadata } from '../../../src/common/plugin/Metadata'
import { makeFakeLog } from '../../utils'

chai.should()
chai.use(chaiAsPromised)

const wait = async (seconds: number): Promise<void> =>
  await new Promise(resolve => setTimeout(resolve, seconds * 1000))

describe('makeMetadata', () => {
  let metadata: Metadata
  const log: EdgeLog = makeFakeLog()
  const emitter = new EngineEmitter()

  before(async () => {
    metadata = await makeMetadata({
      txDatabase: await makeMemoryTxDatabase({
        walletId: Buffer.alloc(32, 0x11).toString('base64'),
        pluginId: 'bitcoin'
      }),
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
