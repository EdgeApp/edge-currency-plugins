import * as bitcoin from 'altcoin-js'

import { ScriptTypeEnum } from '../keymanager'
import { Input, Output, UTXO, UtxoPickerResult } from './types'

/*
Reference: https://bitcoinops.org/en/tools/calc-size/
*/

const WITNESS_SCALE = 4
const OP_CODE_SIZE = 1
const SIGNATURE_SIZE = 72
const PUB_KEY_SIZE = 33
const P2SH_SCRIPT_HASH_SIZE = 22
const OUTPOINT_SIZE = 36
const N_SEQUENCE_SIZE = 4

// Measures the VarInt given a size
export const compactSize = (num: number): number =>
  num < 0xfd ? 1 : num <= 0xffff ? 3 : num <= 0xffffffff ? 5 : 9

// Adds a VarInt to the size given
export const withCompactSize = (num: number): number => {
  return compactSize(num) + num
}

const scriptSizeMap = ((): { [scriptType: string]: number } => {
  // VarInt OP_PUSH <signature> OP_PUSH <public key>
  const p2pkh = withCompactSize(
    OP_CODE_SIZE + SIGNATURE_SIZE + OP_CODE_SIZE + PUB_KEY_SIZE
  )
  // <p2pkh> <witness count (assumed to be 1)> (segwit)
  const p2wpkh = (p2pkh + compactSize(1)) / WITNESS_SCALE
  // VarInt <script hash>
  const p2shOverhead = withCompactSize(P2SH_SCRIPT_HASH_SIZE)
  // <p2wpkh> <p2sh>
  const p2wpkhp2sh = p2wpkh + p2shOverhead
  // (fixed size)
  const replayProtection = 284

  // TOOD: support other p2sh (e.g. 2-3 multisig) and other p2wsh (taproot/lightning)
  return {
    p2pkh: p2pkh,
    p2wpkh: p2wpkh,
    p2wpkhp2sh: p2wpkhp2sh,
    replayprotection: replayProtection,
    replayprotectionp2sh: 284
  }
})()

export function inputBytes(input: UTXO): number {
  const scriptSigSize = scriptSizeMap[input.scriptType]

  if (scriptSigSize == null)
    throw new Error(`${input.scriptType} script type not supported, yet`)

  return OUTPOINT_SIZE + scriptSigSize + N_SEQUENCE_SIZE
}

export function outputBytes(output: Output): number {
  const nValue = 8 // output value/amount
  const scriptPubkeyLength = compactSize(output.script.length) // scriptPubKey length varint
  /*
    scriptPubKey bytes:
      p2pkh: 25
      p2wpkh: 22
      p2sh: 23
      p2wsh: 34
  */
  const scriptPubkeySize = output.script.length

  return nValue + scriptPubkeyLength + scriptPubkeySize
}

export function dustThreshold(output: Output, feeRate: number): number {
  return feeForBytes(feeRate, outputBytes(output))
}

function witnessCount(inputs: UTXO[]): number {
  return inputs.reduce((sum, input) => {
    if (
      input.scriptType === ScriptTypeEnum.p2wsh ||
      input.scriptType === ScriptTypeEnum.p2wpkhp2sh ||
      input.scriptType === ScriptTypeEnum.p2wpkh
    ) {
      sum++
    }

    return sum
  }, 0)
}

export function transactionBytes(inputs: UTXO[], outputs: Output[]): number {
  // Overhead:
  const nVersion = 4 // fixed 4 bytes
  const inputCount = compactSize(inputs.length) // varint
  const outputCount = compactSize(outputs.length) // varint
  const nLockTime = 4 // fixed 4 bytes
  let overhead = nVersion + inputCount + outputCount + nLockTime
  const numWitnesses = witnessCount(inputs)
  if (numWitnesses > 0) {
    // <segwit marker> <segwit flag> (segwit)
    overhead += Math.ceil(2 / WITNESS_SCALE)
  }

  // Inputs/Outputs:
  const inputsSize = inputs.reduce((a, x) => a + inputBytes(x), 0)
  const outputsSize = outputs.reduce((a, x) => a + outputBytes(x), 0)

  return overhead + inputsSize + outputsSize
}

export const transactionSizeFromHex = (hex: string): number => {
  const transaction = bitcoin.Transaction.fromHex(hex)
  return transaction.virtualSize()
}

export function uintOrNaN(v: number): number {
  if (!isFinite(v)) return NaN
  if (Math.floor(v) !== v) return NaN
  if (v < 0) return NaN
  return v
}

/**
 * Validates a fee rate in satoshis per byte. Fee rates may be fractional,
 * unlike the satoshi values they produce: a rate is always multiplied by a
 * byte count and rounded up before it becomes a satoshi amount.
 */
export function feeRateOrNaN(v: number): number {
  if (!isFinite(v)) return NaN
  if (v < 0) return NaN
  return v
}

/**
 * Returns the whole number of satoshis required to pay for `bytes` at
 * `feeRate` satoshis per byte. Always rounds up, so a fractional rate can
 * never produce a fractional satoshi amount and can never underpay.
 */
export function feeForBytes(feeRate: number, bytes: number): number {
  // Multiplying a fractional rate carries floating point noise: `1.1 * 10` is
  // 11.000000000000002, which would round an exact satoshi amount up to the
  // next satoshi. Snap the product back to 12 significant digits first, which
  // is far more precision than any real fee needs, but well short of the noise.
  return Math.ceil(parseFloat((feeRate * bytes).toPrecision(12)))
}

export function sumForgiving(range: Array<{ value: number }>): number {
  return range.reduce((a, x) => a + (isFinite(x.value) ? x.value : 0), 0)
}

export function sumOrNaN(range: Array<{ value: number }>): number {
  return range.reduce((a, x) => a + uintOrNaN(x.value), 0)
}

export function finalize(
  inputs: Input[],
  outputs: Output[],
  feeRate: number,
  changeScript: string
): UtxoPickerResult {
  const inValue = sumOrNaN(inputs)
  const outValue = sumOrNaN(outputs)
  let txSize = transactionBytes(inputs, outputs)
  let fee = feeForBytes(feeRate, txSize)

  const changeValue = inValue - (outValue + fee)
  const changeOutput: Output = {
    script: Buffer.from(changeScript, 'hex'),
    scriptPubkey: Buffer.from(changeScript, 'hex'),
    value: changeValue
  }
  const changeOutputSize = outputBytes(changeOutput)
  txSize += changeOutputSize
  const changeFee = feeForBytes(feeRate, changeOutputSize)
  changeOutput.value -= changeFee
  let changeUsed = false
  if (changeOutput.value > dustThreshold(changeOutput, feeRate)) {
    outputs.push(changeOutput)
    fee += changeFee
    changeUsed = true
  } else {
    fee += changeValue
  }

  return { inputs, outputs, changeUsed, fee }
}
