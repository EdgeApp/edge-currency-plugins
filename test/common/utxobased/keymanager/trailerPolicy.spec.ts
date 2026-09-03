// Importing keymanager installs the trailer policy as a side effect, which is
// what these assertions exercise.
import '../../../../src/common/utxobased/keymanager/keymanager'

import { Transaction } from 'altcoin-js'
import { expect } from 'chai'
import { describe, it } from 'mocha'

/**
 * Builds a PIVX-shaped transaction: a normal Bitcoin body whose 4-byte version
 * carries `nVersion` in the low half and `nType` in the high half, with an
 * opaque Sapling trailer after the locktime.
 */
const pivxTx = (nVersion: number, nType: number, trailer: string): string => {
  const version = ((nType << 16) | nVersion) >>> 0
  const versionHex = Buffer.alloc(4)
  versionHex.writeUInt32LE(version, 0)
  const body =
    '01' + // one input
    '00'.repeat(32) + // prevout hash
    '00000000' + // prevout index
    '00' + // empty scriptSig
    'ffffffff' + // sequence
    '01' + // one output
    '0000000000000000' + // value
    '00' + // empty scriptPubkey
    '00000000' // locktime
  return versionHex.toString('hex') + body + trailer
}

describe('transaction trailer policy', () => {
  const trailer = 'deadbeef'

  it('preserves a Sapling trailer and re-serializes it byte-identically', () => {
    const hex = pivxTx(3, 0, trailer)
    const tx = Transaction.fromHex(hex)

    const { trailer: parsed } = tx
    if (parsed == null) throw new Error('trailer was not preserved')
    expect(Buffer.from(parsed).toString('hex')).to.equal(trailer)
    // byteLength must account for the trailer or toBuffer overruns its buffer.
    expect(tx.byteLength()).to.equal(hex.length / 2)
    expect(tx.toHex()).to.equal(hex)
  })

  it('handles a PIVX special transaction, whose nType widens the version', () => {
    // nType 1 makes the 32-bit version read as 65539 rather than 3, which is
    // why the policy masks off the low 16 bits instead of matching on 3.
    const hex = pivxTx(3, 1, trailer)
    const tx = Transaction.fromHex(hex)

    expect(tx.version).to.equal(65539)
    const { trailer: parsed } = tx
    if (parsed == null) throw new Error('trailer was not preserved')
    expect(Buffer.from(parsed).toString('hex')).to.equal(trailer)
    expect(tx.toHex()).to.equal(hex)
  })

  it('still rejects trailing data on a pre-Sapling version', () => {
    expect(() => Transaction.fromHex(pivxTx(1, 0, trailer))).to.throw(
      'Transaction has unexpected data'
    )
  })

  it('leaves segwit parsing alone, including Bitcoin version 3 TRUC', () => {
    // A v3 segwit transaction must still parse as segwit. Disabling witness
    // detection for version 3 to accommodate PIVX would break these.
    const segwitV3 =
      '03000000' + // version 3
      '0001' + // segwit marker and flag
      '01' +
      '00'.repeat(32) +
      '00000000' +
      '00' +
      'ffffffff' +
      '01' +
      '0000000000000000' +
      '00' +
      '01' + // one witness item
      '00' + // empty witness element
      '00000000'
    const tx = Transaction.fromHex(segwitV3)

    expect(tx.hasWitnesses()).to.equal(true)
    expect(tx.version).to.equal(3)
    expect(tx.toHex()).to.equal(segwitV3)
  })
})
