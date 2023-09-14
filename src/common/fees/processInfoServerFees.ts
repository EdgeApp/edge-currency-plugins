import { asSimpleFeeSettings, SimpleFeeSettings } from '../plugin/types'

/**
 * Processes the fee object from Edge Info Server
 * @param fees
 * @returns {SimpleFeeSettings}
 */
export const processInfoServerFees = (
  fees: unknown
): SimpleFeeSettings | null => {
  try {
    return asSimpleFeeSettings(fees)
  } catch {
    return null
  }
}
