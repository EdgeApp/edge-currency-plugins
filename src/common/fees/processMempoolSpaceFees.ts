import * as bs from 'biggystring'
import { asNumber, asObject } from 'cleaners'

import { LOW_FEE } from '../constants'
import { FeeRates } from '../plugin/types'

export const asMempoolSpaceFees = asObject({
  fastestFee: asNumber,
  halfHourFee: asNumber,
  hourFee: asNumber
})

/**
 * Calculates the FeeRates object from MempoolSpace
 * Sets the minimum of LOW_FEE on all fee levels
 * @param fees
 * @returns Partial<FeeRates>
 */

const STANDARD_FEE_HIGH_MULTIPLIER = 1.3
const HIGH_FEE_MULTIPLIER = 2

export const processMempoolSpaceFees = (fees: unknown): FeeRates | null => {
  let mempoolFees: ReturnType<typeof asMempoolSpaceFees>
  try {
    mempoolFees = asMempoolSpaceFees(fees)
  } catch {
    return null
  }

  const { fastestFee, halfHourFee } = mempoolFees

  const lowFee = halfHourFee.toString()
  const standardFeeLow = fastestFee.toString()
  const standardFeeHigh = Math.round(
    fastestFee * STANDARD_FEE_HIGH_MULTIPLIER
  ).toString()
  const highFee = Math.round(fastestFee * HIGH_FEE_MULTIPLIER).toString()

  return {
    lowFee: bs.max(lowFee, LOW_FEE.toString()),
    standardFeeLow: bs.max(standardFeeLow, LOW_FEE.toString()),
    standardFeeHigh: bs.max(standardFeeHigh, LOW_FEE.toString()),
    highFee: bs.max(highFee, LOW_FEE.toString())
  }
}
