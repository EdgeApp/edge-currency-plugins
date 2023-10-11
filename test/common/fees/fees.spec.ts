import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { makeMemoryDisklet } from 'disklet'
import { MemoryStorage } from 'disklet/lib/src/backends/memory'

import { FEES_PATH } from '../../../src/common/constants'
import { Fees, makeFees } from '../../../src/common/fees/makeFees'
import { FeeInfo } from '../../../src/common/plugin/types'
import { makeFakeIo, makeFakeLog, makeFakePluginInfo } from '../../utils'

chai.should()
chai.use(chaiAsPromised)
const { expect } = chai

describe('fees', function () {
  const fakeIo = makeFakeIo()
  const fakeLog = makeFakeLog()
  const fakeMakePluginInfo = makeFakePluginInfo()
  const memory: MemoryStorage = {}
  const disklet = makeMemoryDisklet(memory)
  let fees: Fees

  const testJson = (expected?: FeeInfo): void => {
    const str = memory[`/${FEES_PATH}`]
    if (typeof str === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expected == null
        ? expect(str).to.be.undefined
        : expect(JSON.parse(str)).to.eql(expected)
    }
  }

  describe('makeFees', () => {
    it('should load fees from the currency info file on wallet first load', async () => {
      fees = await makeFees({
        disklet,
        pluginInfo: fakeMakePluginInfo,
        io: fakeIo,
        log: fakeLog
      })

      fees.feeInfo.should.eql(fakeMakePluginInfo.engineInfo.simpleFeeSettings)

      testJson()
    })

    it('should cache fees after started', async () => {
      await fees.start()

      testJson(fakeMakePluginInfo.engineInfo.simpleFeeSettings)

      // be sure to stop after start, test will hang otherwise
      fees.stop()
    })
  })
})
