import * as bs from 'biggystring'
import { EdgeSpendInfo } from 'edge-core-js/lib/types'

import { EngineCurrencyInfo } from '../../plugin/types'

export function calculateFeeRate(
  currencyInfo: EngineCurrencyInfo,
  spendInfo: EdgeSpendInfo
): string {
  const { customFeeSettings, simpleFeeSettings } = currencyInfo
  const {
    otherParams,
    customNetworkFee,
    networkFeeOption = 'standard',
    spendTargets
  } = spendInfo

  if (otherParams?.paymentProtocolInfo?.merchant?.requiredFeeRate) {
    const requiredFeeRate =
      otherParams.paymentProtocolInfo.merchant.requiredFeeRate
    const rate = bs.mul(requiredFeeRate, '1.5')
    return bs.toFixed(rate, 0, 0)
  }

  const customFeeSetting = customFeeSettings[0]
  const customFeeAmount = customNetworkFee?.[customFeeSetting] ?? '0'
  if (networkFeeOption === 'custom' && customFeeAmount !== '0') {
    return customFeeAmount
  } else {
    const amountForTx = spendTargets
      .reduce((s, { nativeAmount }) => s + parseInt(nativeAmount ?? '0'), 0)
      .toString()
    let rate = '0'
    switch (networkFeeOption) {
      case 'low':
        rate = simpleFeeSettings.lowFee
        break

      case 'standard': {
        if (bs.gte(amountForTx, simpleFeeSettings.standardFeeHighAmount)) {
          rate = simpleFeeSettings.standardFeeHigh
          break
        }
        if (bs.lte(amountForTx, simpleFeeSettings.standardFeeLowAmount)) {
          rate = simpleFeeSettings.standardFeeLow
          break
        }

        // Scale the fee by the amount the user is sending scaled between standardFeeLowAmount and standardFeeHighAmount
        const lowHighAmountDiff = bs.sub(
          simpleFeeSettings.standardFeeHighAmount,
          simpleFeeSettings.standardFeeLowAmount
        )
        const lowHighFeeDiff = bs.sub(
          simpleFeeSettings.standardFeeHigh,
          simpleFeeSettings.standardFeeLow
        )

        // How much above the lowFeeAmount is the user sending
        const amountDiffFromLow = bs.sub(
          amountForTx,
          simpleFeeSettings.standardFeeLowAmount
        )

        // Add this much to the low fee = (amountDiffFromLow * lowHighFeeDiff) / lowHighAmountDiff)
        const temp1 = bs.mul(amountDiffFromLow, lowHighFeeDiff)
        const addFeeToLow = bs.div(temp1, lowHighAmountDiff)
        rate = bs.add(simpleFeeSettings.standardFeeLow, addFeeToLow)
        break
      }

      case 'high':
        rate = simpleFeeSettings.highFee
        break

      default:
        throw new Error(
          `Invalid networkFeeOption: ${networkFeeOption}, And/Or customFee: ${customFeeAmount}`
        )
    }
    return rate
  }
}
