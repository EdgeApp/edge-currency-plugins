import { assert, expect } from 'chai'
import { describe, it } from 'mocha'

import {
  feeForBytes,
  feeRateOrNaN,
  uintOrNaN
} from '../../../../../src/common/utxobased/keymanager/utxopicker/utils'

describe('utxopicker uintOrNaN', function () {
  it('accepts whole numbers', function () {
    expect(uintOrNaN(0)).to.equal(0)
    expect(uintOrNaN(1)).to.equal(1)
    expect(uintOrNaN(546)).to.equal(546)
  })

  it('rejects fractional values, because satoshis are indivisible', function () {
    assert.isNaN(uintOrNaN(1.8))
    assert.isNaN(uintOrNaN(0.5))
  })

  it('rejects negative and non-finite values', function () {
    assert.isNaN(uintOrNaN(-1))
    assert.isNaN(uintOrNaN(Infinity))
    assert.isNaN(uintOrNaN(NaN))
  })
})

describe('utxopicker feeRateOrNaN', function () {
  it('accepts fractional rates', function () {
    expect(feeRateOrNaN(1.8)).to.equal(1.8)
    expect(feeRateOrNaN(0.25)).to.equal(0.25)
    expect(feeRateOrNaN(12.345)).to.equal(12.345)
  })

  it('accepts whole rates', function () {
    expect(feeRateOrNaN(0)).to.equal(0)
    expect(feeRateOrNaN(1)).to.equal(1)
    expect(feeRateOrNaN(1000)).to.equal(1000)
  })

  it('rejects negative and non-finite rates', function () {
    assert.isNaN(feeRateOrNaN(-1))
    assert.isNaN(feeRateOrNaN(-0.5))
    assert.isNaN(feeRateOrNaN(Infinity))
    assert.isNaN(feeRateOrNaN(NaN))
  })
})

describe('utxopicker feeForBytes', function () {
  it('multiplies whole rates exactly', function () {
    expect(feeForBytes(1, 141)).to.equal(141)
    expect(feeForBytes(2, 141)).to.equal(282)
    expect(feeForBytes(20, 250)).to.equal(5000)
  })

  it('rounds fractional results up, never down', function () {
    // 1.8 * 141 = 253.8
    expect(feeForBytes(1.8, 141)).to.equal(254)
    // 0.5 * 141 = 70.5
    expect(feeForBytes(0.5, 141)).to.equal(71)
    // 2.5 * 3 = 7.5
    expect(feeForBytes(2.5, 3)).to.equal(8)
  })

  it('does not overpay when the product is exactly a whole satoshi', function () {
    // Guards floating point noise: 1.1 * 10 evaluates to 11.000000000000002,
    // and 1.8 * 5 evaluates to 9.000000000000002.
    expect(feeForBytes(1.1, 10)).to.equal(11)
    expect(feeForBytes(1.8, 5)).to.equal(9)
    expect(feeForBytes(0.1, 30)).to.equal(3)
    expect(feeForBytes(2.9, 10)).to.equal(29)
  })

  it('always returns a whole number for any fractional rate', function () {
    const rates = [0.1, 0.5, 1.1, 1.8, 2.25, 3.333, 12.7]
    const byteCounts = [1, 10, 31, 110, 141, 226, 1000]
    for (const rate of rates) {
      for (const bytes of byteCounts) {
        const fee = feeForBytes(rate, bytes)
        expect(Number.isInteger(fee), `${rate} * ${bytes} = ${fee}`).to.equal(
          true
        )
      }
    }
  })

  it('never charges less than the requested rate', function () {
    const rates = [0.1, 0.5, 1.1, 1.8, 2.25, 3.333, 12.7]
    const byteCounts = [1, 10, 31, 110, 141, 226, 1000]
    for (const rate of rates) {
      for (const bytes of byteCounts) {
        const fee = feeForBytes(rate, bytes)
        // Compare against the exact product, allowing for the rounding the
        // helper applies to the floating point noise itself.
        expect(fee + 1e-6, `${rate} * ${bytes}`).to.be.at.least(rate * bytes)
      }
    }
  })

  it('is monotonic in the fee rate', function () {
    const bytes = 226
    let previous = 0
    for (const rate of [1, 1.2, 1.4, 1.6, 1.8, 2]) {
      const fee = feeForBytes(rate, bytes)
      expect(fee, `rate ${rate}`).to.be.at.least(previous)
      previous = fee
    }
  })

  it('distinguishes 1.8 from 1, the reported bug', function () {
    const bytes = 226
    expect(feeForBytes(1.8, bytes)).to.not.equal(feeForBytes(1, bytes))
    expect(feeForBytes(1.8, bytes)).to.be.greaterThan(feeForBytes(1, bytes))
    expect(feeForBytes(1.8, bytes)).to.be.lessThan(feeForBytes(2, bytes))
  })
})
