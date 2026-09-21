import { assert } from 'chai'
import { describe, it } from 'mocha'

import { processMempoolSpaceFees } from '../../../src/common/fees/processMempoolSpaceFees'

describe('processMempoolSpaceFees', function () {
  it('preserves the decimals from the precise endpoint', function () {
    // A real `/api/v1/fees/precise` response.
    const result = processMempoolSpaceFees({
      fastestFee: 1,
      halfHourFee: 0.575,
      hourFee: 0.313,
      economyFee: 0.2,
      minimumFee: 0.1
    })

    assert.deepEqual(result, {
      lowFee: '0.575',
      standardFeeLow: '1',
      standardFeeHigh: '1.3',
      highFee: '2'
    })
  })

  it('multiplies fractional rates without floating point noise', function () {
    // 0.575 * 1.3 evaluates to 0.7474999999999999 in floating point.
    const result = processMempoolSpaceFees({
      fastestFee: 0.575,
      halfHourFee: 0.313,
      hourFee: 0.2
    })

    assert.equal(result?.standardFeeHigh, '0.7475')
    assert.equal(result?.highFee, '1.15')
  })

  it('no longer raises sub-2 rates to a hardcoded floor', function () {
    const result = processMempoolSpaceFees({
      fastestFee: 0.2,
      halfHourFee: 0.1,
      hourFee: 0.1
    })

    // Every one of these would have been clamped to '2' by the old LOW_FEE.
    assert.deepEqual(result, {
      lowFee: '0.1',
      standardFeeLow: '0.2',
      standardFeeHigh: '0.26',
      highFee: '0.4'
    })
  })

  it('still handles whole-number rates from the recommended endpoint', function () {
    const result = processMempoolSpaceFees({
      fastestFee: 12,
      halfHourFee: 8,
      hourFee: 5
    })

    assert.deepEqual(result, {
      lowFee: '8',
      standardFeeLow: '12',
      standardFeeHigh: '15.6',
      highFee: '24'
    })
  })

  it('returns null for a malformed response', function () {
    assert.equal(processMempoolSpaceFees({ fastestFee: 1 }), null)
    assert.equal(processMempoolSpaceFees(undefined), null)
  })
})
