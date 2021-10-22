'use strict'

import base58 from 'bs58'
import { Buffer } from 'buffer'

interface Base58BaseReturn {
  encode: (payload: Buffer) => string
  decode: (stringPayload: string | undefined) => Buffer
  decodeUnsafe: (stringPayload: string) => Buffer | undefined
}

export function base58Base(
  checksumFn: (buffer: Buffer) => Buffer
): Base58BaseReturn {
  // Encode a buffer as a base58-check encoded string
  function encode(payload: Buffer): string {
    const checksum: Buffer = checksumFn(payload)

    return base58.encode(Buffer.concat([payload, checksum], payload.length + 4))
  }

  function decodeRaw(buffer: Buffer): Buffer | undefined {
    const payload = buffer.slice(0, -4)
    const checksum = buffer.slice(-4)
    const newChecksum = checksumFn(payload)

    if (
      ((checksum[0] ^ newChecksum[0]) |
        (checksum[1] ^ newChecksum[1]) |
        (checksum[2] ^ newChecksum[2]) |
        (checksum[3] ^ newChecksum[3])) ===
      1
    )
      return

    return payload
  }

  // Decode a base58-check encoded string to a buffer, no result if checksum is wrong
  function decodeUnsafe(stringPayload: string): Buffer | undefined {
    const buffer = base58.decodeUnsafe(stringPayload)
    if (buffer == null) return

    return decodeRaw(buffer)
  }

  function decode(payload: string | undefined): Buffer {
    if (payload == null) throw new Error('Invalid base58 string')
    const buffer = base58.decode(payload)
    const bPayload = decodeRaw(buffer)
    if (bPayload == null) throw new Error('Invalid checksum')
    return bPayload
  }

  return {
    encode,
    decode,
    decodeUnsafe
  }
}
