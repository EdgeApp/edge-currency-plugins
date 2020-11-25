import { ScriptTypeEnum } from '../keymanager'
import { Input, Output, Result, UTXO } from './types'

const WITNESS_SCALE = 4

export function sizeVarint(num: number): number {
  if (num < 0xfd)
    return 1;
  if (num <= 0xffff)
    return 3;
  if (num <= 0xffffffff)
    return 5;
  return 9;
}

export function inputBytes (input: UTXO): number {
  const base = 40 + sizeVarint(input.script.length)

  let scriptSize = 0
  switch (input.scriptType) {
    case ScriptTypeEnum.p2pkh:
    case ScriptTypeEnum.p2wpkh:
    case ScriptTypeEnum.p2wpkhp2sh:
      // signature + public key
      scriptSize += 108
    case ScriptTypeEnum.p2sh:
    case ScriptTypeEnum.p2wsh:
    case ScriptTypeEnum.p2wpkhp2sh:
      // 2-of-3 multisig input
      scriptSize += 253
    case ScriptTypeEnum.p2wpkh:
    case ScriptTypeEnum.p2wpkhp2sh:
    case ScriptTypeEnum.p2wsh:
      scriptSize += WITNESS_SCALE - 1
      scriptSize /= WITNESS_SCALE
      scriptSize = scriptSize| 0
  }

  return base + scriptSize
}

export function outputBytes (output: Output) {
  const base = 8 + sizeVarint(output.script.length)

  let scriptSize = 0
  switch (output.scriptType) {
    case ScriptTypeEnum.p2pkh:
      scriptSize = 25
      break
    case ScriptTypeEnum.p2wpkh:
      scriptSize = 22
      break
    case ScriptTypeEnum.p2sh:
      scriptSize = 23
      break
    case ScriptTypeEnum.p2wsh:
      scriptSize = 34
      break
  }

  return base + scriptSize
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
  let total = 0;

  // Calculate the size, minus the input scripts.
  total += 4;
  total += sizeVarint(inputs.length);
  total += sizeVarint(outputs.length);
  total += 4;

  const numWitnesses = witnessCount(inputs)
  if (numWitnesses > 0) {
    total += 2
    total += numWitnesses
  }

  total += inputs.reduce((a, x) => a + inputBytes(x), 0)
  total += outputs.reduce((a, x) => a + outputBytes(x), 0)

  return total
}

export function uintOrNaN (v: number): number {
  if (!isFinite(v)) return NaN
  if (Math.floor(v) !== v) return NaN
  if (v < 0) return NaN
  return v
}

export function sumForgiving (range: { value: number }[]): number {
  return range.reduce((a, x) => a + (isFinite(x.value) ? x.value : 0), 0)
}

export function sumOrNaN (range: { value: number }[]): number {
  return range.reduce((a, x) => a + uintOrNaN(x.value), 0)
}

export function finalize (inputs: Input[], outputs: Output[], feeRate: number, changeScript: string): Result {
  const inValue = sumOrNaN(inputs)
  const outValue = sumOrNaN(outputs)
  let fee = feeRate * transactionBytes(inputs, outputs)

  const changeValue = inValue - (outValue + fee)
  const changeOutput: Output = {
    script: Buffer.from(changeScript, 'hex'),
    value: changeValue
  }
  const changeFee = feeRate * outputBytes(changeOutput)
  changeOutput.value -= changeFee
  let changeUsed = false
  if (changeOutput.value > dustThreshold(changeOutput, feeRate)) {
    outputs.push(changeOutput)
    fee += changeFee
    changeUsed = true
  } else {
    fee += changeValue
  }
  console.log('bytes: ', transactionBytes(inputs, outputs))

  return { inputs, outputs, changeUsed, fee }
}
