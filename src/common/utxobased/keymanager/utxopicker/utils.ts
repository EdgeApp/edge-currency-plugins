/* eslint-disable no-fallthrough */
/* eslint-disable no-duplicate-case */
import { ScriptTypeEnum } from '../keymanager'
import { Input, Output, UTXO, UtxoPickerResult } from './types'

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

export function inputBytes(input: UTXO): number {
  let scriptSigSize = 0
  switch (input.scriptType) {
    case ScriptTypeEnum.p2pkh: {
      // VarInt OP_PUSH signature OP_PUSH public key
      scriptSigSize += withCompactSize(
        OP_CODE_SIZE + SIGNATURE_SIZE + OP_CODE_SIZE + PUB_KEY_SIZE
      )
      break
    }
    case ScriptTypeEnum.p2wpkh: {
      // VarInt OP_PUSH signature OP_PUSH public key
      scriptSigSize += withCompactSize(
        OP_CODE_SIZE + SIGNATURE_SIZE + OP_CODE_SIZE + PUB_KEY_SIZE
      )
      scriptSigSize /= WITNESS_SCALE
      break
    }
    case ScriptTypeEnum.p2wpkhp2sh: {
      // VarInt OP_PUSH signature OP_PUSH public key
      scriptSigSize += withCompactSize(
        OP_CODE_SIZE + SIGNATURE_SIZE + OP_CODE_SIZE + PUB_KEY_SIZE
      )
      scriptSigSize += OP_CODE_SIZE // Witness Item Count
      scriptSigSize /= WITNESS_SCALE
      scriptSigSize += OP_CODE_SIZE + P2SH_SCRIPT_HASH_SIZE
      break
    }
    case ScriptTypeEnum.p2sh: {
      throw new Error('p2sh not supported, yet')
    }
    case ScriptTypeEnum.p2wsh: {
      throw new Error('p2wsh not supported, yet')
    }
    case ScriptTypeEnum.replayProtectionP2SH:
    case ScriptTypeEnum.replayProtection: {
      scriptSigSize += 284
      break
    }
  }
  return OUTPOINT_SIZE + Math.ceil(scriptSigSize) + N_SEQUENCE_SIZE
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
  return outputBytes(output) * feeRate
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
    overhead += 2 // Segwit Marker / Segwit Flag
  }

  // Inputs/Outputs:
  const inputsSize = inputs.reduce((a, x) => a + inputBytes(x), 0)
  const outputsSize = outputs.reduce((a, x) => a + outputBytes(x), 0)

  return overhead + inputsSize + outputsSize
}

export function uintOrNaN(v: number): number {
  if (!isFinite(v)) return NaN
  if (Math.floor(v) !== v) return NaN
  if (v < 0) return NaN
  return v
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
  let fee = feeRate * txSize

  const changeValue = inValue - (outValue + fee)
  const changeOutput: Output = {
    script: Buffer.from(changeScript, 'hex'),
    scriptPubkey: Buffer.from(changeScript, 'hex'),
    value: changeValue
  }
  const changeOutputSize = outputBytes(changeOutput)
  txSize += changeOutputSize
  const changeFee = feeRate * changeOutputSize
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
