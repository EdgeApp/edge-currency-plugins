import { EdgeTransaction } from 'edge-core-js'

import { IProcessorTransaction } from '../../db/types'

export const defaultValidateConfirmations = (
  tx: IProcessorTransaction,
  blockHeight: number,
  requiredConfirmations: number = 1
): EdgeTransaction['confirmations'] => {
  const blockConfirmations =
    tx.blockHeight === 0 ? 0 : 1 + blockHeight - tx.blockHeight
  const confirmations: EdgeTransaction['confirmations'] =
    blockConfirmations >= requiredConfirmations
      ? 'confirmed'
      : blockConfirmations <= 0
      ? 'unconfirmed'
      : blockConfirmations
  return confirmations
}
