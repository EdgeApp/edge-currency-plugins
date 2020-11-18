import * as bitcoin from 'altcoin-js'

import { scriptPubkeyToType, ScriptTypeEnum } from '../keymanager'
import { Input, Output, Result, Target, UTXO } from './types'

const TX_EMPTY_SIZE = 4 + 1 + 1 + 4
const TX_INPUT_BASE = 32 + 4 + 1 + 4
const TX_OUTPUT_BASE = 8
const WITNESS_SCALE = 4

// function sizeVarint(num) {
//   if (num < 0xfd)
//     return 1;
//   if (num <= 0xffff)
//     return 3;
//   if (num <= 0xffffffff)
//     return 5;
//   return 9;
// };
//
// async function estimateSize() {
//   const witnessScale = 4
//
//   let total = 0;
//
//   // Calculate the size, minus the input scripts.
//   total += 4;
//   total += sizeVarint(this.inputs.length);
//   total += this.inputs.length * 40;
//
//   total += sizeVarint(this.outputs.length);
//
//   for (const output of this.outputs)
//     total += output.getSize();
//
//   total += 4;
//
//   // Add size for signatures and public keys
//   for (const {prevout} of this.inputs) {
//     const coin = this.view.getOutput(prevout);
//
//     // We're out of luck here.
//     // Just assume it's a p2pkh.
//     if (!coin) {
//       total += 110;
//       continue;
//     }
//
//     // Previous output script.
//     const prev = coin.script;
//
//     // P2PK
//     if (prev.isPubkey()) {
//       // varint script size
//       total += 1;
//       // OP_PUSHDATA0 [signature]
//       total += 1 + 73;
//       continue;
//     }
//
//     // P2PKH
//     if (prev.isPubkeyhash()) {
//       // varint script size
//       total += 1;
//       // OP_PUSHDATA0 [signature]
//       total += 1 + 73;
//       // OP_PUSHDATA0 [key]
//       total += 1 + 33;
//       continue;
//     }
//
//     const [m] = prev.getMultisig();
//     if (m !== -1) {
//       let size = 0;
//       // Bare Multisig
//       // OP_0
//       size += 1;
//       // OP_PUSHDATA0 [signature] ...
//       size += (1 + 73) * m;
//       // varint len
//       size += encoding.sizeVarint(size);
//       total += size;
//       continue;
//     }
//
//     // P2WPKH
//     if (prev.isWitnessPubkeyhash()) {
//       let size = 0;
//       // varint-items-len
//       size += 1;
//       // varint-len [signature]
//       size += 1 + 73;
//       // varint-len [key]
//       size += 1 + 33;
//       // vsize
//       size = (size + witnessScale - 1) / witnessScale | 0;
//       total += size;
//       continue;
//     }
//
//     // ---------
//     const address = prev.getAddress()
//     if (!address) return -1
//
//     if (prev.isWitnessPubKeyhashInScripthash()) {
//       let size = 0
//
//       size += 23 // redeem script
//       size *= 4 // vsize
//       // Varint witness items length.
//       size += 1
//       // Calculate vsize
//       size = ((size + witnessScale - 1) / witnessScale) | 0
//       // witness portion
//       // OP_PUSHDATA0 [signature]
//       let witness = 1 + 73
//       // OP_PUSHDATA0 [key]
//       witness += 1 + 33
//       size += witness / witnessScale
//       total += size
//     }
//
//     // P2SH
//     if (prev.isScripthash()) {
//       // varint size
//       total += 1;
//       // 2-of-3 multisig input
//       total += 149;
//       continue;
//     }
//
//     // P2WSH
//     if (prev.isWitnessScripthash()) {
//       let size = 0;
//       // varint-items-len
//       size += 1;
//       // 2-of-3 multisig input
//       size += 149;
//       // vsize
//       size = (size + witnessScale - 1) / witnessScale | 0;
//       total += size;
//       continue;
//     }
//
//     // Unknown.
//     total += 110;
//   }
//
//   return total;
// };

export function inputBytes (input: UTXO) {
  let total = 0
  const scriptType = scriptPubkeyToType(input.script.toString('hex'))
  switch (scriptType) {
    case ScriptTypeEnum.p2pkh:
      // varint script size
      total += 1
      // OP_PUSHDATA0 [signature]
      total += 1 + 73
      // OP_PUSHDATA0 [key]
      total += 1 + 33
      break
    case ScriptTypeEnum.p2sh:
      // varint size
      total += 1
      // 2-of-3 multisig input
      total += 149
      break
    case ScriptTypeEnum.p2wpkhp2sh:
      // redeem script
      total += 23
      // vsize
      total *= 4
      // varint witness items length
      total += 1
      // calculate vsize
      total = ((total + WITNESS_SCALE - 1) / WITNESS_SCALE) | 0
      // witness portion
      total += (1 + 73 + 1 + 33 / WITNESS_SCALE)
      break
    case ScriptTypeEnum.p2wpkh:
      // varint size
      total += 1
      // varint size [signature]
      total += 1 + 73
      // varint size [key]
      total += 1 + 33
      // vsize
      total += (total + WITNESS_SCALE - 1) / WITNESS_SCALE | 0
      break
  }
  return TX_INPUT_BASE + total
}

export function outputBytes (output: Output) {
  // return TX_OUTPUT_BASE + output.script.length
  return TX_OUTPUT_BASE + 1 + 149
}

export function dustThreshold (feeRate: number): number {
  return (1 + 149) * feeRate
}

export function transactionBytes (inputs: UTXO[], outputs: Output[]): number {
  return TX_EMPTY_SIZE +
    inputs.reduce((a, x) => a + inputBytes(x), 0) +
    outputs.reduce((a, x) => a + outputBytes(x), 0)
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
  if (changeOutput.value > dustThreshold(feeRate)) {
    outputs.push(changeOutput)
    fee += changeFee
    changeUsed = true
  } else {
    fee += changeValue
  }
  console.log('bytes: ', transactionBytes(inputs, outputs))

  return { inputs, outputs, changeUsed, fee }
}
