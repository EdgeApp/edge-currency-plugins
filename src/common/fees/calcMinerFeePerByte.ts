import * as bs from 'biggystring'
import { EdgeSpendInfo } from 'edge-core-js'

import { SimpleFeeSettings } from '../plugin/types'

type NetworkFeeOption = EdgeSpendInfo['networkFeeOption']

/**
 * Calculate the sat/byte mining fee given an amount to spend and a SimpleFeeSettings object
 * @param nativeAmount
 * @param fees
 * @param networkFeeOption
 * @param customNetworkFee
 * @returns {string}
 */
export const calcMinerFeePerByte = (
  nativeAmount: string,
  fees: SimpleFeeSettings,
  networkFeeOption?: NetworkFeeOption,
  customNetworkFee?: string
): string => {
  switch (networkFeeOption) {
    case 'low':
      return fees.lowFee

    case 'standard': {
      if (bs.gte(nativeAmount, fees.standardFeeHighAmount)) {
        return fees.standardFeeHigh
      }
      if (bs.lte(nativeAmount, fees.standardFeeLowAmount)) {
        return fees.standardFeeLow
      }

      // Scale the fee by the amount the user is sending scaled between standardFeeLowAmount and standardFeeHighAmount
      const lowHighAmountDiff = bs.sub(
        fees.standardFeeHighAmount,
        fees.standardFeeLowAmount
      )
      const lowHighFeeDiff = bs.sub(fees.standardFeeHigh, fees.standardFeeLow)

      // How much above the lowFeeAmount is the user sending
      const amountDiffFromLow = bs.sub(nativeAmount, fees.standardFeeLowAmount)

      // Add this much to the low fee = (amountDiffFromLow * lowHighFeeDiff) / lowHighAmountDiff)
      const temp1 = bs.mul(amountDiffFromLow, lowHighFeeDiff)
      const addFeeToLow = bs.div(temp1, lowHighAmountDiff)
      return bs.add(fees.standardFeeLow, addFeeToLow)
    }

    case 'high':
      return fees.highFee

    case 'custom':
      if (customNetworkFee == null || customNetworkFee === '0') {
        throw new Error(`Invalid custom network fee: ${customNetworkFee}`)
      }
      return customNetworkFee

    default:
      throw new Error(`Invalid networkFeeOption: ${networkFeeOption}`)
  }
}
