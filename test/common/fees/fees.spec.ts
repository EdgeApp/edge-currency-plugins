import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

import { Fees, makeFees } from '../../../src/common/fees/makeFees'
import { makePluginStore } from '../../../src/common/plugin/pluginStore'
import { FeeInfo } from '../../../src/common/plugin/types'
import {
  makeFakeIo,
  makeFakeLog,
  makeFakePluginInfo,
  makeMemoryPluginStore
} from '../../utils'

chai.should()
chai.use(chaiAsPromised)
const { expect } = chai

describe('fees', function () {
  const fakeIo = makeFakeIo()
  const fakeLog = makeFakeLog()
  const fakeMakePluginInfo = makeFakePluginInfo()
  const store = makeMemoryPluginStore()
  const pluginStore = makePluginStore(store)
  let fees: Fees

  const storedFees = async (): Promise<FeeInfo | undefined> => {
    const [result] = await store.getRows([{ table: 'fee', keys: ['fees'] }])
    const row = result.rows[0] as { doc: FeeInfo } | undefined
    return row?.doc
  }

  describe('makeFees', () => {
    it('should load fees from the currency info file on wallet first load', async () => {
      fees = await makeFees({
        pluginStore,
        pluginInfo: fakeMakePluginInfo,
        io: fakeIo,
        log: fakeLog
      })

      fees.feeInfo.should.eql(fakeMakePluginInfo.engineInfo.defaultFeeInfo)
      expect(await storedFees()).equals(undefined)
    })

    it('should cache fees after started', async () => {
      await fees.start()

      // Whatever the servers answered, merged over the defaults, as JSON
      // stores it:
      expect(await storedFees()).eql(JSON.parse(JSON.stringify(fees.feeInfo)))

      // be sure to stop after start, test will hang otherwise
      fees.stop()
    })

    it('should forget the cached fees when cleared', async () => {
      await fees.clearCache()
      expect(await storedFees()).equals(undefined)
    })
  })
})
