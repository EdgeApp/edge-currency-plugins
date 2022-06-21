import { Output, UTXO, UtxoPickerArgs, UtxoPickerResult } from './types'
import * as utils from './utils'
// implementation very similar to accumulative strategy
// add inputs until we reach or surpass the target value (or deplete)
// worst-case: O(n)

export function forceUseUtxo(args: UtxoPickerArgs): UtxoPickerResult {
  const { utxos, useUtxos, targets, feeRate, changeScript } = args

  if (!isFinite(utils.uintOrNaN(feeRate))) {
    throw new Error('No rate provided')
  }

  const outputs: Output[] = targets.map(target => ({
    ...target,
    script: Buffer.from(target.script, 'hex'),
    scriptPubkey: Buffer.from(target.script, 'hex')
  }))

  const inputs: UTXO[] = useUtxos ?? []
  let inValue = inputs.reduce((n, { value }) => n + value, 0)
  const targetValue = utils.sumOrNaN(targets)
  const bytes = utils.transactionBytes(inputs, outputs)
  const fee = bytes * feeRate
  // if the new feeRate is already covered by lowering the change amount, return
  if (inValue >= targetValue + fee) {
    return utils.finalize(inputs, outputs, feeRate, changeScript)
  }

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
    const fee = bytes * feeRate

    // go again?
    if (inValue < targetValue + fee) continue

    return utils.finalize(inputs, outputs, feeRate, changeScript)
  }

  return {
    changeUsed: false,
    fee: Math.ceil(feeRate * utils.transactionBytes(inputs, outputs))
  }
}
