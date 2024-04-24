import { EdgeCurrencyInfo, EdgeMemoOption } from 'edge-core-js/types'

export const utxoCustomFeeTemplate: EdgeCurrencyInfo['customFeeTemplate'] = [
  {
    type: 'nativeAmount',
    key: 'satPerByte',
    displayName: 'Satoshis Per Byte',
    displayMultiplier: '0'
  }
]

export const utxoMemoOptions: EdgeMemoOption[] = [
  {
    type: 'hex',
    hidden: true,
    maxBytes: 80,
    memoName: 'OP_RETURN'
  }
]

// Deprecated:
export const legacyMemoInfo: Partial<EdgeCurrencyInfo> = {
  memoMaxLength: 80,
  memoType: 'text'
}
