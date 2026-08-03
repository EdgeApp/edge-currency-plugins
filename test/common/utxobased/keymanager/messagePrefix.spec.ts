import { expect } from 'chai'
import { describe, it } from 'mocha'

import { all } from '../../../../src/common/utxobased/info/all'

// `bitcoinjs-message` copies `messagePrefix` into the magic hash verbatim and
// only varint-encodes the message length, so the prefix must carry its own
// leading CompactSize byte. This mirrors `ss << strMessageMagic` in the coins'
// C++, which serializes the std::string as CompactSize(len) + bytes. A prefix
// whose leading byte disagrees with its length produces a hash no wallet or
// node will verify against, and the failure is silent at signing time.
describe('coin messagePrefix', () => {
  all.forEach(info => {
    const { name, prefixes } = info.coinInfo
    prefixes.messagePrefix.forEach((prefix, index) => {
      it(`${name} messagePrefix[${index}] length byte matches`, () => {
        const buf = Buffer.from(prefix, 'utf8')
        expect(buf[0]).to.equal(
          buf.length - 1,
          `expected leading byte 0x${(buf.length - 1).toString(
            16
          )} for ${JSON.stringify(prefix)}`
        )
      })
    })
  })
})
