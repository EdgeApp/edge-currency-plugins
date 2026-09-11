import { assert } from 'chai'
import { describe, it } from 'mocha'

import { calcMinerFeePerByte } from '../../../src/common/fees/calcMinerFeePerByte'

describe(`Mining Fees`, function () {
  it('calcMinerFeePerByte standard high', function () {
    const nativeAmount = '100000000'
    const feeOption = 'standard'
    const customFee = '15'
    const bitcoinFees = {
      lowFeeFudgeFactor: undefined,
      standardFeeLowFudgeFactor: undefined,
      standardFeeHighFudgeFactor: undefined,
      highFeeFudgeFactor: undefined,

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
      lowFeeFudgeFactor: undefined,
      standardFeeLowFudgeFactor: undefined,
      standardFeeHighFudgeFactor: undefined,
      highFeeFudgeFactor: undefined,

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
      lowFeeFudgeFactor: undefined,
      standardFeeLowFudgeFactor: undefined,
      standardFeeHighFudgeFactor: undefined,
      highFeeFudgeFactor: undefined,

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
      lowFeeFudgeFactor: undefined,
      standardFeeLowFudgeFactor: undefined,
      standardFeeHighFudgeFactor: undefined,
      highFeeFudgeFactor: undefined,

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
      lowFeeFudgeFactor: undefined,
      standardFeeLowFudgeFactor: undefined,
      standardFeeHighFudgeFactor: undefined,
      highFeeFudgeFactor: undefined,

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
      lowFeeFudgeFactor: undefined,
      standardFeeLowFudgeFactor: undefined,
      standardFeeHighFudgeFactor: undefined,
      highFeeFudgeFactor: undefined,

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
  it('calcMinerFeePerByte custom preserves a fractional rate', function () {
    const nativeAmount = '150000'
    const feeOption = 'custom'
    const bitcoinFees = {
      lowFeeFudgeFactor: undefined,
      standardFeeLowFudgeFactor: undefined,
      standardFeeHighFudgeFactor: undefined,
      highFeeFudgeFactor: undefined,

      lowFee: '10',
      standardFeeLow: '50',
      standardFeeHigh: '100',
      highFee: '350',
      standardFeeLowAmount: '100000',
      standardFeeHighAmount: '200000',
      timestamp: 0
    }
    for (const customFee of ['1.8', '0.5', '12.345']) {
      const result = calcMinerFeePerByte(
        nativeAmount,
        bitcoinFees,
        feeOption,
        customFee
      )
      assert.equal(result, customFee)
    }
  })
  it('calcMinerFeePerByte preserves fractional preset rates', function () {
    const bitcoinFees = {
      lowFeeFudgeFactor: undefined,
      standardFeeLowFudgeFactor: undefined,
      standardFeeHighFudgeFactor: undefined,
      highFeeFudgeFactor: undefined,

      lowFee: '0.575',
      standardFeeLow: '1',
      standardFeeHigh: '1.3',
      highFee: '2',
      standardFeeLowAmount: '100000',
      standardFeeHighAmount: '200000',
      timestamp: 0
    }
    // Each of these used to round to a whole sat/vB, and 'low' rounded to '1'.
    assert.equal(calcMinerFeePerByte('10000', bitcoinFees, 'low'), '0.575')
    assert.equal(calcMinerFeePerByte('10000', bitcoinFees, 'high'), '2')
    assert.equal(calcMinerFeePerByte('10000', bitcoinFees, 'standard'), '1')
    assert.equal(calcMinerFeePerByte('999999', bitcoinFees, 'standard'), '1.3')
  })
  it('calcMinerFeePerByte does not round a sub-1 rate down to zero', function () {
    const bitcoinFees = {
      lowFeeFudgeFactor: undefined,
      standardFeeLowFudgeFactor: undefined,
      standardFeeHighFudgeFactor: undefined,
      highFeeFudgeFactor: undefined,

      lowFee: '0.1',
      standardFeeLow: '0.2',
      standardFeeHigh: '0.26',
      highFee: '0.4',
      standardFeeLowAmount: '100000',
      standardFeeHighAmount: '200000',
      timestamp: 0
    }
    // '0.1' rounded to '0' before, which then threw `Invalid fee rate: 0`
    // in makeSpend rather than building a transaction.
    assert.equal(calcMinerFeePerByte('10000', bitcoinFees, 'low'), '0.1')
    assert.equal(calcMinerFeePerByte('10000', bitcoinFees, 'standard'), '0.2')
    assert.equal(calcMinerFeePerByte('10000', bitcoinFees, 'high'), '0.4')
  })
  it('calcMinerFeePerByte interpolates standard with decimal precision', function () {
    const bitcoinFees = {
      lowFeeFudgeFactor: undefined,
      standardFeeLowFudgeFactor: undefined,
      standardFeeHighFudgeFactor: undefined,
      highFeeFudgeFactor: undefined,

      lowFee: '0.1',
      standardFeeLow: '1',
      standardFeeHigh: '2',
      highFee: '3',
      standardFeeLowAmount: '0',
      standardFeeHighAmount: '1000',
      timestamp: 0
    }
    // Halfway between the two amounts is halfway between the two rates. The
    // old `div` default of zero decimal places truncated this to '1'.
    assert.equal(calcMinerFeePerByte('500', bitcoinFees, 'standard'), '1.5')
    assert.equal(calcMinerFeePerByte('250', bitcoinFees, 'standard'), '1.25')
  })
  it('calcMinerFeePerByte applies fudge factors to fractional rates', function () {
    const bitcoinFees = {
      lowFeeFudgeFactor: '1.5',
      standardFeeLowFudgeFactor: undefined,
      standardFeeHighFudgeFactor: undefined,
      highFeeFudgeFactor: '0.5',

      lowFee: '0.575',
      standardFeeLow: '1',
      standardFeeHigh: '1.3',
      highFee: '2',
      standardFeeLowAmount: '100000',
      standardFeeHighAmount: '200000',
      timestamp: 0
    }
    assert.equal(calcMinerFeePerByte('10000', bitcoinFees, 'low'), '0.863')
    assert.equal(calcMinerFeePerByte('10000', bitcoinFees, 'high'), '1')
  })
})
