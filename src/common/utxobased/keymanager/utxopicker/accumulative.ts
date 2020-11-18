import * as bitcoin from 'altcoin-js'

import * as utils from './utils'
import { UTXO, Target, Result, Output } from './types'
// add inputs until we reach or surpass the target value (or deplete)
// worst-case: O(n)

export function accumulative(utxos: UTXO[], targets: Target[], feeRate: number, changeScript: string): Result {
  if (!isFinite(utils.uintOrNaN(feeRate))) {
    throw new Error('No rate provided')
  }

  let bytes = 0

  const outputs: Output[] = []
  for (const target of targets) {
    const output: Output = {
      script: Buffer.from(target.script, 'hex'),
      value: target.value
    }
    outputs.push(output)
    bytes += utils.outputBytes(output)
  }

  let inValue = 0
  let fee = bytes * feeRate
  const inputs: UTXO[] = []
  const targetValue = utils.sumOrNaN(targets)

  for (let i = 0; i < utxos.length; ++i) {
    const utxo = utxos[i]
    const utxoBytes = utils.inputBytes(utxo)
    const utxoFee = feeRate * utxoBytes
    bytes += utxoBytes
    fee += utxoFee

    // skip detrimental input
    if (utxoFee > utxo.value) {
      if (i === utxos.length - 1) {
        break
      } else {
        continue
      }
    }

    inputs.push(utxo)
    inValue += utxo.value

    // go again?
    if (inValue < targetValue + fee) continue

    return utils.finalize(inputs, outputs, feeRate, changeScript)
  }

  return { fee: feeRate * bytes }
}
