import { EdgeCurrencyInfo } from 'edge-core-js/types'

export const memoInfo: Partial<EdgeCurrencyInfo> = {
  memoOptions: [
    {
      type: 'hex',
      hidden: true,
      maxBytes: 80,
      memoName: 'OP_RETURN'
    }
  ],

  // Deprecated:
  memoMaxLength: 80,
  memoType: 'text'
}
