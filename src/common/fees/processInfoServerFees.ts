import { asObject, asString } from 'cleaners'

import { SimpleFeeSettings } from '../plugin/types'

const asInfoServerFees = asObject<SimpleFeeSettings>({
  lowFee: asString,
  standardFeeLow: asString,
  standardFeeHigh: asString,
  highFee: asString,

  // The amount of satoshis which will be charged the standardFeeLow
  standardFeeLowAmount: asString,
  // The amount of satoshis which will be charged the standardFeeHigh
  standardFeeHighAmount: asString
})

/**
 * Processes the fee object from Edge Info Server
 * @param fees
 * @returns {SimpleFeeSettings}
 */
export const processInfoServerFees = (
  fees: unknown
): SimpleFeeSettings | null => {
  try {
    return asInfoServerFees(fees)
  } catch {
    return null
  }
}
