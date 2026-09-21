import { FEE_RATE_DECIMALS } from '../constants'

/**
 * Calculate the sat/vB fee rate for a transaction that replaces another by fee:
 * double the rate the replaced transaction paid.
 *
 * The rate rounds up to FEE_RATE_DECIMALS places. Rounding up means the
 * replacement never pays less than double, and a positive rate never rounds
 * down to zero, which the UTXO picker would accept as a valid rate. Rounding
 * to a fixed number of places keeps the rate readable where it is reported as
 * `feeRateUsed`.
 *
 * @param replacedFee The fee the replaced transaction paid, in satoshis
 * @param replacedVBytes The replaced transaction's virtual size
 * @returns {number}
 */
export const calcReplacementFeeRate = (
  replacedFee: number,
  replacedVBytes: number
): number => {
  const scale = 10 ** FEE_RATE_DECIMALS
  // The fee and size are whole numbers, so this division is exact whenever the
  // scaled rate is, and Math.ceil sees no floating point noise.
  return Math.ceil((replacedFee * 2 * scale) / replacedVBytes) / scale
}
