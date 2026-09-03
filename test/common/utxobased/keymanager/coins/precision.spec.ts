import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  addressToScriptPubkey,
  makeTx,
  ScriptTypeEnum
} from '../../../../../src/common/utxobased/keymanager/keymanager'
import {
  biggystringToBigInt,
  bigIntToBiggystring
} from '../../../../../src/common/utxobased/keymanager/utxopicker/bigMath'

/**
 * Satoshi amounts above 2^53 used to lose precision, because the picker and the
 * PSBT construction downcast the decimal strings they were handed to `number`.
 *
 * Dogecoin is the reason this matters in practice: at roughly 150 billion coins
 * of supply and 1e8 satoshis to the coin, ordinary balances land in the range
 * where a double can no longer represent every integer.
 */
describe('satoshi precision above 2^53', () => {
  const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER) // 9007199254740991

  const address = 'DQTjL9vfXVbMfCGM49KWeYvvvNzRPaoiFp'
  const scriptPubkey = addressToScriptPubkey({ address, coin: 'dogecoin' })

  describe('bigMath', () => {
    it('round-trips an amount above 2^53 exactly', () => {
      // One satoshi above the largest integer a double can represent, plus a
      // realistic Dogecoin balance well beyond it.
      for (const amount of [
        (MAX_SAFE + 1n).toString(),
        '90071992547409910',
        '150000000000000000'
      ]) {
        expect(bigIntToBiggystring(biggystringToBigInt(amount))).to.equal(
          amount
        )
      }
    })

    it('demonstrates the loss the old parseInt path had', () => {
      // The precise failure this migration exists to fix: parseInt rounds to
      // the nearest representable double, bigint does not.
      const amount = '90071992547409911'
      expect(parseInt(amount).toString()).to.not.equal(amount)
      expect(biggystringToBigInt(amount).toString()).to.equal(amount)
    })

    it('rejects a fractional or negative amount rather than truncating', () => {
      expect(() => biggystringToBigInt('12.5')).to.throw()
      expect(() => biggystringToBigInt('-1')).to.throw()
      expect(() => biggystringToBigInt('')).to.throw()
      expect(() => biggystringToBigInt('abc')).to.throw()
    })
  })

  describe('makeTx', () => {
    /**
     * The parent transaction a legacy input has to supply, paying `value` to
     * our scriptPubkey. Building it by hand also exercises 64-bit value
     * serialization, since the amount does not fit in a double.
     */
    const parentTx = (value: string): string => {
      const amount = Buffer.alloc(8)
      amount.writeBigUInt64LE(BigInt(value), 0)
      const script = Buffer.from(scriptPubkey, 'hex')
      const scriptLen = Buffer.from([script.length])
      return (
        '01000000' + // version
        '01' + // one input
        '00'.repeat(32) + // prevout hash
        'ffffffff' + // prevout index
        '00' + // empty scriptSig
        'ffffffff' + // sequence
        '01' + // one output
        amount.toString('hex') +
        scriptLen.toString('hex') +
        script.toString('hex') +
        '00000000' // locktime
      )
    }

    /** A UTXO whose value exceeds what a double can represent exactly. */
    const hugeUtxo = (value: string): any => ({
      id: '0',
      scriptType: ScriptTypeEnum.p2pkh,
      txid: '00'.repeat(32),
      scriptPubkey,
      value,
      blockHeight: 1,
      spent: false,
      script: parentTx(value),
      vout: 0
    })

    it('carries an above-2^53 input value through to the picker result', () => {
      // Both amounts sit above 2^53, and the margin between them is a whole
      // coin so the fee never decides the outcome. The trailing digits are
      // deliberately odd: a double would round them away.
      const value = '90071992547409911'
      const target = '90071992447409907'

      const tx = makeTx({
        forceUseUtxo: [],
        coin: 'dogecoin',
        currencyCode: 'DOGE',
        enableRbf: false,
        freshChangeAddress: address,
        feeRate: 1,
        subtractFee: false,
        utxos: [hugeUtxo(value)],
        targets: [{ address, value: biggystringToBigInt(target) }],
        memos: [],
        outputSort: 'bip69'
      })

      // The selected input keeps every digit.
      expect(tx.inputs).to.have.lengthOf(1)
      expect(tx.inputs[0].value.toString()).to.equal(value)

      // So does the target output, and the amounts balance exactly: the sum of
      // the outputs plus the fee equals the input, with no rounding slack.
      const outputSum = tx.outputs.reduce((sum, o) => sum + o.value, 0n)
      expect(outputSum + tx.fee).to.equal(biggystringToBigInt(value))

      const targetOutput = tx.outputs.find(
        o => o.value === biggystringToBigInt(target)
      )
      expect(targetOutput, 'target output preserved exactly').to.not.equal(
        undefined
      )
    })

    it('produces a change amount a double could not represent', () => {
      // Chosen so the change lands above 2^53 as well, which is where the old
      // code silently rounded.
      const value = '180000000000000001'
      const target = '90000000000000000'

      const tx = makeTx({
        forceUseUtxo: [],
        coin: 'dogecoin',
        currencyCode: 'DOGE',
        enableRbf: false,
        freshChangeAddress: address,
        feeRate: 1,
        subtractFee: false,
        utxos: [hugeUtxo(value)],
        targets: [{ address, value: biggystringToBigInt(target) }],
        memos: [],
        outputSort: 'bip69'
      })

      expect(tx.changeUsed).to.equal(true)
      const outputSum = tx.outputs.reduce((sum, o) => sum + o.value, 0n)
      expect(outputSum + tx.fee).to.equal(biggystringToBigInt(value))

      // The odd final digit survives, which is the whole point — a double
      // would have rounded it away.
      expect((outputSum + tx.fee) % 10n).to.equal(1n)
    })
  })
})
