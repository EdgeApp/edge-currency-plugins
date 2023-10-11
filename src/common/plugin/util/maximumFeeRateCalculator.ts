import { div, mul, round } from 'biggystring'
import { EdgeCurrencyInfo } from 'edge-core-js/types'

/**
 * Calculates a maximum fee rate of 1 USD per vByte given a USD exchange rate
 * (usdPrice).
 */
export const maximumFeeRateCalculator = (
  currencyInfo: EdgeCurrencyInfo,
  usdPrice: number
): string | undefined => {
  const { currencyCode, denominations } = currencyInfo
  const primaryDenomination = denominations.find(
    denom => denom.name === currencyCode
  )
  if (primaryDenomination == null)
    throw new Error(`Missing primary currency denomination for ${currencyCode}`)

  return round(
    mul(div('1', String(usdPrice), 16), primaryDenomination.multiplier),
    0
  )
}
