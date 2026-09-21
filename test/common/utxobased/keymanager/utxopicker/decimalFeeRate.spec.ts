import { expect } from 'chai'
import { describe, it } from 'mocha'

import { UtxoData } from '../../../../../src/common/utxobased/db/types'
import { info as bitcoin } from '../../../../../src/common/utxobased/info/bitcoin'
import {
  AddressTypeEnum,
  makeTx,
  MakeTxReturn,
  MakeTxTarget,
  privateKeyEncodingToPubkey,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  ScriptTypeEnum,
  signTx,
  wifToPrivateKeyEncoding
} from '../../../../../src/common/utxobased/keymanager/keymanager'
import { transactionSizeFromHex } from '../../../../../src/common/utxobased/keymanager/utxopicker/utils'

const wifKey = 'L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr'
const privateKeyEncoding = wifToPrivateKeyEncoding({ wifKey, coin: 'bitcoin' })
const segwitScriptPubkey: string = pubkeyToScriptPubkey({
  pubkey: privateKeyEncodingToPubkey(privateKeyEncoding),
  scriptType: ScriptTypeEnum.p2wpkh
}).scriptPubkey
const segwitAddress: string = scriptPubkeyToAddress({
  scriptPubkey: segwitScriptPubkey,
  coin: 'bitcoin',
  addressType: AddressTypeEnum.p2wpkh
}).address
const changeAddress = segwitAddress

/**
 * Builds a spendable p2wpkh UTXO. The txid only has to be unique and
 * well-formed, since none of these tests touch the network.
 */
const makeUtxo = (index: number, value: string): UtxoData => ({
  id: String(index),
  txid: String(index).padStart(2, '0').repeat(32),
  vout: 0,
  value,
  scriptPubkey: segwitScriptPubkey,
  script: segwitScriptPubkey,
  scriptType: ScriptTypeEnum.p2wpkh,
  blockHeight: 100,
  spent: false
})

interface BuildTxOpts {
  feeRate: number
  targets: MakeTxTarget[]
  utxos: UtxoData[]
  forceUseUtxo?: UtxoData[]
  subtractFee?: boolean
}

const buildTx = (opts: BuildTxOpts): MakeTxReturn =>
  makeTx({
    coin: 'bitcoin',
    currencyCode: 'BTC',
    enableRbf: false,
    freshChangeAddress: changeAddress,
    forceUseUtxo: opts.forceUseUtxo ?? [],
    feeRate: opts.feeRate,
    memos: [],
    outputSort: 'bip69',
    subtractFee: opts.subtractFee ?? false,
    targets: opts.targets,
    utxos: opts.utxos
  })

const sumInputs = (tx: MakeTxReturn): number =>
  tx.inputs.reduce((total, input) => total + input.value, 0)

const sumOutputs = (tx: MakeTxReturn): number =>
  tx.outputs.reduce((total, output) => total + output.value, 0)

describe('makeTx with a fractional fee rate', function () {
  this.timeout(10000)

  const utxos = [makeUtxo(1, '100000')]
  const targets: MakeTxTarget[] = [{ address: segwitAddress, value: 50000 }]

  it('does not truncate 1.8 down to 1, the reported bug', function () {
    const oneSat = buildTx({ feeRate: 1, targets, utxos })
    const fractional = buildTx({ feeRate: 1.8, targets, utxos })
    const twoSat = buildTx({ feeRate: 2, targets, utxos })

    expect(fractional.fee).to.not.equal(oneSat.fee)
    expect(fractional.fee).to.be.greaterThan(oneSat.fee)
    expect(fractional.fee).to.be.lessThan(twoSat.fee)
  })

  it('charges a fee proportional to the fractional rate', function () {
    const oneSat = buildTx({ feeRate: 1, targets, utxos })
    const fractional = buildTx({ feeRate: 1.8, targets, utxos })

    // Same inputs and outputs, so the size is identical and the fee should
    // scale with the rate, give or take the rounding up of each component.
    expect(fractional.inputs.length).to.equal(oneSat.inputs.length)
    expect(fractional.outputs.length).to.equal(oneSat.outputs.length)
    expect(fractional.fee).to.be.at.least(Math.floor(oneSat.fee * 1.8))
    expect(fractional.fee).to.be.at.most(Math.ceil(oneSat.fee * 1.8) + 2)
  })

  it('produces a whole satoshi fee and whole satoshi outputs', function () {
    for (const feeRate of [0.5, 1.1, 1.8, 2.25, 3.333, 12.7]) {
      const tx = buildTx({ feeRate, targets, utxos })
      expect(Number.isInteger(tx.fee), `fee at rate ${feeRate}`).to.equal(true)
      for (const output of tx.outputs) {
        expect(
          Number.isInteger(output.value),
          `output ${output.value} at rate ${feeRate}`
        ).to.equal(true)
      }
    }
  })

  it('spends every selected input, conserving value into outputs plus fee', function () {
    for (const feeRate of [0.5, 1.1, 1.8, 2.25, 3.333, 12.7]) {
      const tx = buildTx({ feeRate, targets, utxos })
      expect(sumInputs(tx) - sumOutputs(tx), `rate ${feeRate}`).to.equal(tx.fee)
    }
  })

  it('pays the target the exact requested amount', function () {
    for (const feeRate of [0.5, 1.1, 1.8, 2.25, 3.333, 12.7]) {
      const tx = buildTx({ feeRate, targets, utxos })
      const paid = tx.outputs.filter(output => output.value === 50000)
      expect(paid.length, `rate ${feeRate}`).to.equal(1)
    }
  })

  it('returns change, and the change covers its own fee', function () {
    const tx = buildTx({ feeRate: 1.8, targets, utxos })
    expect(tx.changeUsed).to.equal(true)
    expect(tx.outputs.length).to.equal(2)
    const change = tx.outputs.find(output => output.value !== 50000)
    expect(change).to.not.equal(undefined)
    if (change != null) {
      expect(change.value).to.equal(100000 - 50000 - tx.fee)
    }
  })

  it('is monotonic: a higher fractional rate never costs less', function () {
    let previousFee = 0
    for (const feeRate of [1, 1.2, 1.4, 1.6, 1.8, 2, 2.5, 3]) {
      const tx = buildTx({ feeRate, targets, utxos })
      expect(tx.fee, `rate ${feeRate}`).to.be.at.least(previousFee)
      previousFee = tx.fee
    }
  })

  it('selects additional inputs when the target needs them', function () {
    const manyUtxos = [
      makeUtxo(1, '30000'),
      makeUtxo(2, '30000'),
      makeUtxo(3, '30000')
    ]
    const bigTarget: MakeTxTarget[] = [{ address: segwitAddress, value: 70000 }]
    const tx = buildTx({ feeRate: 1.8, targets: bigTarget, utxos: manyUtxos })

    expect(tx.inputs.length).to.be.at.least(3)
    expect(sumInputs(tx) - sumOutputs(tx)).to.equal(tx.fee)
  })

  it('accepts a rate below one satoshi per byte', function () {
    const tx = buildTx({ feeRate: 0.5, targets, utxos })
    expect(tx.fee).to.be.greaterThan(0)
    expect(Number.isInteger(tx.fee)).to.equal(true)
    expect(sumInputs(tx) - sumOutputs(tx)).to.equal(tx.fee)
  })

  it('rejects a negative rate', function () {
    expect(() => buildTx({ feeRate: -1, targets, utxos })).to.throw(
      'No rate provided'
    )
  })

  it('rejects a non-finite rate', function () {
    expect(() => buildTx({ feeRate: NaN, targets, utxos })).to.throw(
      'No rate provided'
    )
    expect(() => buildTx({ feeRate: Infinity, targets, utxos })).to.throw(
      'No rate provided'
    )
  })

  it('applies a fractional rate through the subtractFee picker', function () {
    const tx = buildTx({ feeRate: 1.8, targets, utxos, subtractFee: true })
    expect(Number.isInteger(tx.fee)).to.equal(true)
    for (const output of tx.outputs) {
      expect(Number.isInteger(output.value)).to.equal(true)
    }
    // The fee comes out of the target rather than out of change.
    expect(sumOutputs(tx)).to.equal(50000 - tx.fee)
  })

  it('applies a fractional rate through the forceUseUtxo picker', function () {
    const forced = makeUtxo(9, '100000')
    const tx = buildTx({
      feeRate: 1.8,
      targets,
      utxos: [],
      forceUseUtxo: [forced]
    })
    expect(tx.inputs.length).to.equal(1)
    expect(Number.isInteger(tx.fee)).to.equal(true)
    expect(sumInputs(tx) - sumOutputs(tx)).to.equal(tx.fee)
  })
})

describe('signing a transaction built at a fractional fee rate', function () {
  this.timeout(10000)

  const utxos = [makeUtxo(1, '100000')]
  const targets: MakeTxTarget[] = [{ address: segwitAddress, value: 50000 }]

  it('produces a signable transaction, which whole satoshi outputs allow', async function () {
    const tx = buildTx({ feeRate: 1.8, targets, utxos })
    const signed = await signTx({
      coin: 'bitcoin',
      feeInfo: bitcoin.engineInfo.defaultFeeInfo,
      privateKeyEncodings: [privateKeyEncoding],
      psbtBase64: tx.psbtBase64
    })
    expect(signed.hex).to.be.a('string')
    expect(signed.hex.length).to.be.greaterThan(0)
  })

  it('charges a fractional rate as accurately as it charges a whole rate', async function () {
    // The picker sizes a transaction before signatures exist, so the rate the
    // final signed transaction actually pays is off by well under a percent.
    // Whole rates carry the same error, so this asserts that fractional rates
    // are no less accurate rather than asserting the picker is exact. A
    // truncated 1.8 would land at a ratio of 0.55 and fail loudly here.
    const wholeRates = [1, 2, 3, 5]
    const fractionalRates = [1.1, 1.8, 2.25, 5.5]

    for (const feeRate of [...wholeRates, ...fractionalRates]) {
      const tx = buildTx({ feeRate, targets, utxos })
      const signed = await signTx({
        coin: 'bitcoin',
        feeInfo: bitcoin.engineInfo.defaultFeeInfo,
        privateKeyEncodings: [privateKeyEncoding],
        psbtBase64: tx.psbtBase64
      })
      const vsize = transactionSizeFromHex(signed.hex)
      const accuracy = tx.fee / vsize / feeRate

      expect(accuracy, `rate ${feeRate}`).to.be.at.least(0.99)
      expect(accuracy, `rate ${feeRate}`).to.be.at.most(1.01)
    }
  })

  it('spends exactly the inputs the picker selected', async function () {
    const tx = buildTx({ feeRate: 1.8, targets, utxos })
    const signed = await signTx({
      coin: 'bitcoin',
      feeInfo: bitcoin.engineInfo.defaultFeeInfo,
      privateKeyEncodings: [privateKeyEncoding],
      psbtBase64: tx.psbtBase64
    })

    // Every selected UTXO's txid appears in the signed transaction, in the
    // byte-reversed form bitcoin uses on the wire.
    for (const input of tx.inputs) {
      const wireTxid = input.hash.toString('hex')
      expect(signed.hex).to.contain(wireTxid)
    }
    expect(tx.inputs.length).to.equal(1)
  })
})
