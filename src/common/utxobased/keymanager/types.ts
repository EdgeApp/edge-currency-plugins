import { Cleaner } from 'cleaners'
import { EdgeTokenId, InsufficientFundsError } from 'edge-core-js/types'

interface InsufficientFundsErrorOptsPlus {
  // The currency we need more of:
  tokenId: EdgeTokenId
  // If we don't have enough funds for a token send:
  networkFee?: string

  networkFeeShortage?: string
}
export class InsufficientFundsErrorPlus extends InsufficientFundsError {
  networkFeeShortage?: string
  constructor(opts: InsufficientFundsErrorOptsPlus) {
    super(opts)
    const { networkFeeShortage } = opts
    this.networkFeeShortage = networkFeeShortage
  }
}

function asMaybeError<T>(name: string): Cleaner<T | undefined> {
  return function asError(raw) {
    if (raw instanceof Error && raw.name === name) {
      const typeHack: any = raw
      return typeHack
    }
  }
}

export const asMaybeInsufficientFundsErrorPlus = asMaybeError<InsufficientFundsErrorPlus>(
  // Share the same name because this error type is a subtype of
  // InsufficientFundsError and therefore backwards compatible
  'InsufficientFundsError'
)
