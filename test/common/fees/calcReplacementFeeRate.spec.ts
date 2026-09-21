import { assert } from 'chai'
import { describe, it } from 'mocha'

import { calcReplacementFeeRate } from '../../../src/common/fees/calcReplacementFeeRate'

describe('calcReplacementFeeRate', function () {
  it('doubles a whole rate exactly', function () {
    // 282 sat over 141 vB is 2 sat/vB.
    assert.equal(calcReplacementFeeRate(282, 141), 4)
  })

  it('keeps a fractional rate rather than rounding to a whole sat/vB', function () {
    // 254 sat over 141 vB is 1.8014 sat/vB, which doubles to 3.6028.
    assert.equal(calcReplacementFeeRate(254, 141), 3.603)
  })

  it('does not round a rate under 0.25 sat/vB down to zero', function () {
    // 15 sat over 141 vB is 0.1064 sat/vB. Math.round doubled this to 0.
    assert.equal(calcReplacementFeeRate(15, 141), 0.213)
    // Far below any relay floor, it still pays something.
    assert.equal(calcReplacementFeeRate(1, 100000), 0.001)
  })

  it('never pays less than double, and overshoots by under 0.001 sat/vB', function () {
    const cases = [
      [15, 141],
      [254, 141],
      [1000, 333],
      [7, 3],
      [162540, 1080]
    ]
    for (const [fee, vBytes] of cases) {
      const exact = (fee / vBytes) * 2
      const rate = calcReplacementFeeRate(fee, vBytes)
      assert.isAtLeast(rate, exact, `${fee} sat over ${vBytes} vB`)
      assert.isBelow(rate - exact, 0.001, `${fee} sat over ${vBytes} vB`)
    }
  })
})
