import { add, div, gte, lte, mul, round, sub } from 'biggystring'
import { EdgeSpendInfo } from 'edge-core-js/types'

import { FEE_RATE_DECIMALS } from '../constants'
import { FeeInfo } from '../plugin/types'

type NetworkFeeOption = EdgeSpendInfo['networkFeeOption']

/**
 * Calculate the sat/byte mining fee given an amount to spend and a SimpleFeeSettings object
 * @param nativeAmount
 * @param feeInfo
 * @param networkFeeOption
 * @param customNetworkFee
 * @returns {string}
 */
export const calcMinerFeePerByte = (
  nativeAmount: string,
  feeInfo: FeeInfo,
  networkFeeOption?: NetworkFeeOption,
  customNetworkFee?: string
): string => {
  const {
    highFeeFudgeFactor = '1',
    lowFeeFudgeFactor = '1',
    standardFeeHighAmount,
    standardFeeHighFudgeFactor = '1',
    standardFeeLowAmount,
    standardFeeLowFudgeFactor = '1'
  } = feeInfo
  let { highFee, lowFee, standardFeeHigh, standardFeeLow } = feeInfo

  // Fee rates may be fractional, so these round to FEE_RATE_DECIMALS places
  // rather than to a whole sat/vB. biggystring's `round` takes the power of ten
  // to round at, so the precision is negated: -3 means three decimal places.
  const feeRatePlaces = -FEE_RATE_DECIMALS
  highFee = round(mul(highFee, highFeeFudgeFactor), feeRatePlaces)
  lowFee = round(mul(lowFee, lowFeeFudgeFactor), feeRatePlaces)
  standardFeeHigh = round(
    mul(standardFeeHigh, standardFeeHighFudgeFactor),
    feeRatePlaces
  )
  standardFeeLow = round(
    mul(standardFeeLow, standardFeeLowFudgeFactor),
    feeRatePlaces
  )

  switch (networkFeeOption) {
    case 'low':
      return lowFee

    case 'standard': {
      if (gte(nativeAmount, standardFeeHighAmount)) {
        return standardFeeHigh
      }
      if (lte(nativeAmount, standardFeeLowAmount)) {
        return standardFeeLow
      }

      // Scale the fee by the amount the user is sending scaled between standardFeeLowAmount and standardFeeHighAmount
      const lowHighAmountDiff = sub(standardFeeHighAmount, standardFeeLowAmount)
      const lowHighFeeDiff = sub(standardFeeHigh, standardFeeLow)

      // How much above the lowFeeAmount is the user sending
      const amountDiffFromLow = sub(nativeAmount, standardFeeLowAmount)

      // Add this much to the low fee = (amountDiffFromLow * lowHighFeeDiff) / lowHighAmountDiff)
      const temp1 = mul(amountDiffFromLow, lowHighFeeDiff)
      // `div` defaults to zero decimal places, which would truncate the
      // interpolated rate back to a whole sat/vB. Unlike `round` above, its
      // precision argument is the number of decimal places, not a power of ten.
      const addFeeToLow = div(temp1, lowHighAmountDiff, FEE_RATE_DECIMALS)
      return add(standardFeeLow, addFeeToLow)
    }

    case 'high':
      return highFee

    case 'custom':
      if (customNetworkFee == null || customNetworkFee === '0') {
        throw new Error(`Invalid custom network fee: ${customNetworkFee}`)
      }
      return customNetworkFee

    default:
      throw new Error(`Invalid networkFeeOption: ${networkFeeOption}`)
  }
}
