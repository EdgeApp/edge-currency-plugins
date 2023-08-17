import { asCodec, asString, Cleaner } from 'cleaners'
import { base16 } from 'rfc4648'

/**
 * A string of hex-encoded binary data.
 */
export const asBase16: Cleaner<Uint8Array> = asCodec(
  raw => base16.parse(asString(raw)),
  clean => base16.stringify(clean).toLowerCase()
)

export function asIntegerString(raw: unknown): string {
  const clean = asString(raw)
  if (!/^\d+$/.test(clean)) {
    throw new Error('Expected an integer string')
  }
  return clean
}
