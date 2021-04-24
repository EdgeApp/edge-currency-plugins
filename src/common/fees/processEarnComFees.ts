import { asArray, asNumber, asObject } from 'cleaners'

import {
  LOW_FEE,
  MAX_FEE,
  MAX_HIGH_DELAY,
  MAX_STANDARD_DELAY,
  MIN_LOW_DELAY,
  MIN_STANDARD_DELAY
} from '../constants'
import { FeeRates } from '../plugin/types'

const asEarnComFee = asObject({
  minFee: asNumber,
  maxFee: asNumber,
  dayCount: asNumber,
  memCount: asNumber,
  minDelay: asNumber,
  maxDelay: asNumber,
  minMinutes: asNumber,
  maxMinutes: asNumber
})

export const asEarnComFees = asObject({
  fees: asArray(asEarnComFee)
})

/**
 * Calculates the FeeRates object from EarnCom
 * @param fees
 * @returns {FeeRates}
 */
export const processEarnComFees = (fees: unknown): FeeRates | null => {
  let earnComFees: ReturnType<typeof asEarnComFees>
  try {
    earnComFees = asEarnComFees(fees)
  } catch {
    return null
  }

  let highDelay = 999999
  let lowDelay = 0
  let highFee = MAX_FEE
  let standardFeeHigh
  let standardFeeLow = MAX_FEE
  let lowFee = MAX_FEE

  for (const fee of earnComFees.fees) {
    // If this is a zero fee estimate, then skip
    if (fee.maxFee < LOW_FEE || fee.minFee < LOW_FEE) {
      continue
    }
    // Set the lowFee if the delay in blocks is less than MAX_HIGH_DELAY.
    if (fee.maxDelay < MAX_HIGH_DELAY) {
      if (fee.maxFee < lowFee) {
        // Set the low fee if the current fee estimate is lower than the previously set low fee
        lowDelay = fee.maxDelay
        lowFee = fee.maxFee
      }
    }

    // Set the high fee only if the delay is MIN_LOW_DELAY
    if (fee.maxDelay <= MIN_LOW_DELAY) {
      if (fee.maxFee < highFee) {
        // Set the low fee if the current fee estimate is lower than the previously set high fee
        highFee = fee.minFee
        highDelay = fee.maxDelay
      }
    }
  }

  // Now find the standard fee range. We want the range to be within a maxDelay of
  // 3 to 18 blocks (about 30 mins to 3 hours). The standard fee at the low end should
  // have a delay less than the lowFee from above. The standard fee at the high end
  // should have a delay that's greater than the highFee from above.
  for (const fee of earnComFees.fees) {
    // If this is a zero fee estimate, then skip
    if (fee.maxFee === 0 || fee.minFee === 0) {
      continue
    }

    if (fee.maxDelay < lowDelay && fee.maxDelay <= MAX_STANDARD_DELAY) {
      if (standardFeeLow > fee.minFee) {
        standardFeeLow = fee.minFee
      }
    }
  }

  // Go backwards looking for lowest standardFeeHigh that:
  // 1. Is < highFee
  // 2. Has a blockDelay > highDelay
  // 3. Has a delay that is > MIN_STANDARD_DELAY
  // Use the highFee as the default standardHighFee
  standardFeeHigh = highFee
  for (let i = earnComFees.fees.length - 1; i >= 0; i--) {
    const fee = earnComFees.fees[i]

    if (i < 0) {
      break
    }
    // If this is a zero fee estimate, then skip
    if (fee.maxFee === 0 || fee.minFee === 0) {
      continue
    }
    // Dont ever go below standardFeeLow
    if (fee.maxFee <= standardFeeLow) {
      break
    }

    if (fee.maxDelay > highDelay) {
      standardFeeHigh = fee.maxFee
    }
    // If we have a delay that's greater than MIN_STANDARD_DELAY, then we're done.
    // Otherwise we'd be getting bigger delays and further reducing fees.
    if (fee.maxDelay >= MIN_STANDARD_DELAY) {
      break
    }
  }
  //
  // Check if we have a complete set of fee info.
  //
  if (
    highFee < MAX_FEE &&
    lowFee < MAX_FEE &&
    standardFeeHigh > 0 &&
    standardFeeLow < MAX_FEE
  ) {
    // Overwrite the fees with those from earn.com
    return {
      lowFee: lowFee.toFixed(0),
      standardFeeLow: standardFeeLow.toFixed(0),
      standardFeeHigh: standardFeeHigh.toFixed(0),
      highFee: highFee.toFixed(0)
    }
  } else {
    return null
  }
}
