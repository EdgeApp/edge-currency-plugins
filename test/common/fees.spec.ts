import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { makeMemoryDisklet } from 'disklet'

import { Fees, FEES_PATH, makeFees } from '../../src/common/fees/makeFees'
import { makeFakeCurrencyInfo, makeFakeIo, makeFakeLog } from '../utils'

chai.should()
chai.use(chaiAsPromised)
const { expect } = chai

describe('fees', function () {
  const fakeIo = makeFakeIo()
  const fakeLog = makeFakeLog()
  const fakeCurrencyInfo = makeFakeCurrencyInfo()
  const memory: any = {}
  const disklet = makeMemoryDisklet(memory)
  let fees: Fees

  const testJson = (expected?: any): void => {
    const str = memory[`/${FEES_PATH}`]
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expected == null
      ? expect(str).to.be.undefined
      : expect(JSON.parse(str)).to.eql(expected)
  }

  describe('makeFees', () => {
    it('should load fees from the currency info file on wallet first load', async () => {
      fees = await makeFees({
        disklet,
        currencyInfo: fakeCurrencyInfo,
        io: fakeIo,
        log: fakeLog
      })

      fees.fees.should.eql(fakeCurrencyInfo.simpleFeeSettings)

      testJson()
    })

    it('should cache fees after started', async () => {
      await fees.start()

      testJson(fakeCurrencyInfo.simpleFeeSettings)
    })
  })
})
