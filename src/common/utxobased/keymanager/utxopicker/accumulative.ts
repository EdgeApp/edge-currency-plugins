import * as bitcoin from 'altcoin-js'

import * as utils from './utils'
import { UTXO, Target, Result, Output } from './types'
// add inputs until we reach or surpass the target value (or deplete)
// worst-case: O(n)

export function accumulative(utxos: UTXO[], targets: Target[], feeRate: number, changeScript: string): Result {
  if (!isFinite(utils.uintOrNaN(feeRate))) {
    throw new Error('No rate provided')
  }

  const outputs: Output[] = targets.map((target) => ({
    ...target,
    script: Buffer.from(target.script, 'hex')
  }))

  let inValue = 0
  const inputs: UTXO[] = []
  const targetValue = utils.sumOrNaN(targets)

  for (let i = 0; i < utxos.length; ++i) {
    const utxo = utxos[i]

    // skip detrimental input
    const utxoFee = feeRate * utils.inputBytes(utxo)
    if (utxoFee > utxo.value) {
      if (i === utxos.length - 1) {
        break
      } else {
        continue
      }
    }

    inputs.push(utxo)
    inValue += utxo.value

    const bytes = utils.transactionBytes(inputs, outputs)
    console.log('tx byte size - accum', bytes)
    const fee = bytes * feeRate

    // go again?
    if (inValue < targetValue + fee) continue

    return utils.finalize(inputs, outputs, feeRate, changeScript)
  }

  return { changeUsed: false, fee: feeRate * utils.transactionBytes(inputs, outputs) }
}
