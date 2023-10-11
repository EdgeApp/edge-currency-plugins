import { asFeeInfo, FeeInfo } from '../plugin/types'

/**
 * Processes the fee object from Edge Info Server
 * @param fees
 * @returns {FeeInfo}
 */
export const processInfoServerFees = (fees: unknown): FeeInfo | null => {
  try {
    return asFeeInfo(fees)
  } catch {
    return null
  }
}
