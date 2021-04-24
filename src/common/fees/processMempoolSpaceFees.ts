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
export const processMempoolSpaceFees = (fees: unknown): FeeRates | null => {
  let mempoolFees: ReturnType<typeof asMempoolSpaceFees>
  try {
    mempoolFees = asMempoolSpaceFees(fees)
  } catch {
    return null
  }

  const standardFeeLow = mempoolFees.hourFee.toString()
  const lowFee = bs.div(standardFeeLow, '2')
  const standardFeeHigh = mempoolFees.halfHourFee.toString()
  const highFee = mempoolFees.fastestFee.toString()

  return {
    lowFee: bs.max(lowFee, LOW_FEE.toString()),
    standardFeeLow: bs.max(standardFeeLow, LOW_FEE.toString()),
    standardFeeHigh: bs.max(standardFeeHigh, LOW_FEE.toString()),
    highFee: bs.max(highFee, LOW_FEE.toString())
  }
}
