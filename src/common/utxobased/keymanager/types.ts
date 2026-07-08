import { asValue, Cleaner } from 'cleaners'
import { EdgeTokenId, InsufficientFundsError } from 'edge-core-js/types'

/**
 * How to encode the header byte of a signed message.
 *  - `electrum`: the legacy format, whose header carries only the recovery id
 *    and key compression. Every verifier understands it, but it says nothing
 *    about the script type.
 *  - `bip137`: additionally encodes the signing address' script type, which
 *    verifiers such as Bringin require for SegWit addresses.
 */
export const asUtxoSignatureFormat = asValue('electrum', 'bip137')
export type UtxoSignatureFormat = ReturnType<typeof asUtxoSignatureFormat>

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

/**
 * The wallet cannot sign for the requested address: either it does not derive
 * it, or the string is not an address of this chain at all. Callers get a
 * stable `name` to branch on instead of matching against the message prose.
 */
export class AddressNotOwnedError extends Error {
  constructor() {
    super('Wallet does not own the address to sign with')
    this.name = 'AddressNotOwnedError'
  }
}

export const asMaybeAddressNotOwnedError = asMaybeError<AddressNotOwnedError>(
  'AddressNotOwnedError'
)

export const asMaybeInsufficientFundsErrorPlus = asMaybeError<InsufficientFundsErrorPlus>(
  // Share the same name because this error type is a subtype of
  // InsufficientFundsError and therefore backwards compatible
  'InsufficientFundsError'
)
