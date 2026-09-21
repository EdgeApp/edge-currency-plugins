export const INFO_SERVER_URI = 'https://info1.edge.app'

// Fees
export const FEES_PATH = 'fees.json'
export const MAX_FEE = 999999999.0
// Fee rates are sat/vB and may be fractional. Three decimal places matches the
// precision of the mempool.space `/fees/precise` endpoint, which is the most
// precise rate source we consume.
export const FEE_RATE_DECIMALS = 3
export const MAX_HIGH_DELAY = 200
export const MAX_STANDARD_DELAY = 6
export const MIN_STANDARD_DELAY = 2
export const MIN_LOW_DELAY = 1
