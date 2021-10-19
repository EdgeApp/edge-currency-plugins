import { assert } from 'chai'
import { describe, it } from 'mocha'

import { calcMinerFeePerByte } from '../../../src/common/fees/calcMinerFeePerByte'

describe(`Mining Fees`, function () {
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
