import * as bs from 'biggystring'
import { asNumber, asObject } from 'cleaners'

import { FeeRates } from '../plugin/types'

export const asMempoolSpaceFees = asObject({
  fastestFee: asNumber,
  halfHourFee: asNumber,
  hourFee: asNumber
})

/**
 * Calculates the FeeRates object from MempoolSpace
 * @param fees
 * @returns Partial<FeeRates>
 */

// The `/fees/precise` endpoint reports rates with up to three decimal places,
// so the multipliers run through biggystring rather than JS numbers. A float
// multiply would reintroduce noise (0.575 * 1.3 is 0.7474999999999999) that
// biggystring carries exactly.
const STANDARD_FEE_HIGH_MULTIPLIER = '1.3'
const HIGH_FEE_MULTIPLIER = '2'

export const processMempoolSpaceFees = (fees: unknown): FeeRates | null => {
  let mempoolFees: ReturnType<typeof asMempoolSpaceFees>
  try {
    mempoolFees = asMempoolSpaceFees(fees)
  } catch {
    return null
  }

  const fastestFee = mempoolFees.fastestFee.toString()
  const halfHourFee = mempoolFees.halfHourFee.toString()

  return {
    lowFee: halfHourFee,
    standardFeeLow: fastestFee,
    standardFeeHigh: bs.mul(fastestFee, STANDARD_FEE_HIGH_MULTIPLIER),
    highFee: bs.mul(fastestFee, HIGH_FEE_MULTIPLIER)
  }
}
