/**
 * Conversions between the decimal strings used at every plugin boundary and
 * the `bigint` values used for coin selection and transaction construction.
 *
 * Both directions are exact. Routing every conversion through here is what
 * keeps a `number` — and therefore a rounding error above 2^53 — from
 * reappearing in the middle of the pipeline.
 */

const INTEGER_STRING = /^-?\d+$/

/**
 * Parses a decimal string amount into a `bigint`.
 *
 * Throws rather than truncating a fractional amount. `parseInt` used to accept
 * `'12.5'` and silently yield `12`; that leniency was a side effect of the
 * parse, never intentional, and a fractional satoshi arriving here means a bug
 * further up that should surface at once. Negative amounts are rejected for the
 * same reason: every value crossing this boundary is a UTXO value, an output
 * amount or a fee, none of which can be below zero.
 */
export function biggystringToBigInt(value: string): bigint {
  if (!INTEGER_STRING.test(value)) {
    throw new Error(`Expected an integer amount, got '${value}'`)
  }
  const out = BigInt(value)
  if (out < 0n) {
    throw new Error(`Expected a non-negative amount, got '${value}'`)
  }
  return out
}

/** Formats a `bigint` amount as a decimal string. */
export function bigIntToBiggystring(value: bigint): string {
  return value.toString()
}
