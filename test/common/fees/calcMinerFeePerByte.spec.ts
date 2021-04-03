import { assert } from 'chai'
import { describe, it } from 'mocha'

import earnComTestFees from '../../../fixtures/earnComFees.json'
import { calcMinerFeePerByte } from '../../../src/common/fees/calcMinerFeePerByte'
import { processEarnComFees } from '../../../src/common/fees/processEarnComFees'
import { SimpleFeeSettings } from '../../../src/common/plugin/types'

describe(`Mining Fees`, function () {
  it('processEarnComFees from earn.com', function () {
    const inBitcoinFees = {
      highFee: '',
      lowFee: '',
      standardFeeLow: '',
      standardFeeHigh: '',
      standardFeeLowAmount: '100000',
      standardFeeHighAmount: '10000000',
      timestamp: 0
    }
    const edgeBitcoinFees = processEarnComFees({ fees: earnComTestFees })
    const outBitcoinFees: SimpleFeeSettings = {
      ...inBitcoinFees,
      ...edgeBitcoinFees
    }
    assert.equal(outBitcoinFees.standardFeeLowAmount, '100000')
    assert.equal(outBitcoinFees.standardFeeHighAmount, '10000000')
    assert.equal(outBitcoinFees.lowFee, '20')
    assert.equal(outBitcoinFees.standardFeeLow, '151')
    assert.equal(outBitcoinFees.standardFeeHigh, '280')
    assert.equal(outBitcoinFees.highFee, '281')
  })
  it('processEarnComFees blank array', function () {
    const inBitcoinFees = {
      lowFee: '11',
      standardFeeLow: '55',
      standardFeeHigh: '333',
      highFee: '666',
      standardFeeLowAmount: '1111111',
      standardFeeHighAmount: '22222222',
      timestamp: 0
    }
    const edgeBitcoinFees = processEarnComFees([])
    const outBitcoinFees: SimpleFeeSettings = {
      ...inBitcoinFees,
      ...edgeBitcoinFees
    }
    assert.equal(outBitcoinFees.standardFeeLowAmount, '1111111')
    assert.equal(outBitcoinFees.standardFeeHighAmount, '22222222')
    assert.equal(outBitcoinFees.lowFee, '11')
    assert.equal(outBitcoinFees.standardFeeLow, '55')
    assert.equal(outBitcoinFees.standardFeeHigh, '333')
    assert.equal(outBitcoinFees.highFee, '666')
  })
  it('processEarnComFees null', function () {
    const inBitcoinFees = {
      lowFee: '11',
      standardFeeLow: '55',
      standardFeeHigh: '333',
      highFee: '666',
      standardFeeLowAmount: '1111111',
      standardFeeHighAmount: '22222222',
      timestamp: 0
    }
    const edgeBitcoinFees = processEarnComFees(null)
    const outBitcoinFees: SimpleFeeSettings = {
      ...inBitcoinFees,
      ...edgeBitcoinFees
    }
    assert.equal(outBitcoinFees.standardFeeLowAmount, '1111111')
    assert.equal(outBitcoinFees.standardFeeHighAmount, '22222222')
    assert.equal(outBitcoinFees.lowFee, '11')
    assert.equal(outBitcoinFees.standardFeeLow, '55')
    assert.equal(outBitcoinFees.standardFeeHigh, '333')
    assert.equal(outBitcoinFees.highFee, '666')
  })
  it('processEarnComFees empty fees', function () {
    const inBitcoinFees = {
      lowFee: '11',
      standardFeeLow: '55',
      standardFeeHigh: '333',
      highFee: '666',
      standardFeeLowAmount: '1111111',
      standardFeeHighAmount: '22222222',
      timestamp: 0
    }
    const edgeBitcoinFees = processEarnComFees([])
    const outBitcoinFees: SimpleFeeSettings = {
      ...inBitcoinFees,
      ...edgeBitcoinFees
    }
    assert.equal(outBitcoinFees.standardFeeLowAmount, '1111111')
    assert.equal(outBitcoinFees.standardFeeHighAmount, '22222222')
    assert.equal(outBitcoinFees.lowFee, '11')
    assert.equal(outBitcoinFees.standardFeeLow, '55')
    assert.equal(outBitcoinFees.standardFeeHigh, '333')
    assert.equal(outBitcoinFees.highFee, '666')
  })
  it('calcMinerFeePerByte standard high', function () {
    const nativeAmount = '100000000'
    const feeOption = 'standard'
    const customFee = '15'
    const bitcoinFees = {
      lowFee: '10',
      standardFeeLow: '50',
      standardFeeHigh: '300',
      highFee: '350',
      standardFeeLowAmount: '100000',
      standardFeeHighAmount: '10000000',
      timestamp: 0
    }
    const result = calcMinerFeePerByte(
      nativeAmount,
      bitcoinFees,
      feeOption,
      customFee
    )
    assert.equal(result, '300')
  })
  it('calcMinerFeePerByte standard low', function () {
    const nativeAmount = '10000'
    const feeOption = 'standard'
    const customFee = '15'
    const bitcoinFees = {
      lowFee: '10',
      standardFeeLow: '50',
      standardFeeHigh: '100',
      highFee: '350',
      standardFeeLowAmount: '100000',
      standardFeeHighAmount: '10000000',
      timestamp: 0
    }
    const result = calcMinerFeePerByte(
      nativeAmount,
      bitcoinFees,
      feeOption,
      customFee
    )
    assert.equal(result, '50')
  })
  it('calcMinerFeePerByte standard mid', function () {
    const nativeAmount = '150000'
    const feeOption = 'standard'
    const customFee = '15'
    const bitcoinFees = {
      lowFee: '10',
      standardFeeLow: '50',
      standardFeeHigh: '100',
      highFee: '350',
      standardFeeLowAmount: '100000',
      standardFeeHighAmount: '200000',
      timestamp: 0
    }
    const result = calcMinerFeePerByte(
      nativeAmount,
      bitcoinFees,
      feeOption,
      customFee
    )
    assert.equal(result, '75')
  })
  it('calcMinerFeePerByte low', function () {
    const nativeAmount = '150000'
    const feeOption = 'low'
    const customFee = '15'
    const bitcoinFees = {
      lowFee: '10',
      standardFeeLow: '50',
      standardFeeHigh: '100',
      highFee: '350',
      standardFeeLowAmount: '100000',
      standardFeeHighAmount: '200000',
      timestamp: 0
    }
    const result = calcMinerFeePerByte(
      nativeAmount,
      bitcoinFees,
      feeOption,
      customFee
    )
    assert.equal(result, '10')
  })
  it('calcMinerFeePerByte high', function () {
    const nativeAmount = '150000'
    const feeOption = 'high'
    const customFee = '15'
    const bitcoinFees = {
      lowFee: '10',
      standardFeeLow: '50',
      standardFeeHigh: '100',
      highFee: '350',
      standardFeeLowAmount: '100000',
      standardFeeHighAmount: '200000',
      timestamp: 0
    }
    const result = calcMinerFeePerByte(
      nativeAmount,
      bitcoinFees,
      feeOption,
      customFee
    )
    assert.equal(result, '350')
  })
  it('calcMinerFeePerByte custom', function () {
    const nativeAmount = '150000'
    const feeOption = 'custom'
    const customFee = '15'
    const bitcoinFees = {
      lowFee: '10',
      standardFeeLow: '50',
      standardFeeHigh: '100',
      highFee: '350',
      standardFeeLowAmount: '100000',
      standardFeeHighAmount: '200000',
      timestamp: 0
    }
    const result = calcMinerFeePerByte(
      nativeAmount,
      bitcoinFees,
      feeOption,
      customFee
    )
    assert.equal(result, '15')
  })
})
