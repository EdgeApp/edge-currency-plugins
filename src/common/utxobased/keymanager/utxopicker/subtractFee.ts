import { Output, UtxoPickerArgs, UtxoPickerResult } from './types'
import * as utils from './utils'

export function subtractFee(args: UtxoPickerArgs): UtxoPickerResult {
  const { utxos, targets, feeRate } = args

  const outputs: Output[] = targets.map(target => ({
    ...target,
    script: Buffer.from(target.script, 'hex')
  }))

  const fee = feeRate * utils.transactionBytes(utxos, outputs)
  targets[0].value -= fee
  outputs[0].value -= fee
  return { inputs: utxos, outputs, fee, changeUsed: false }
}
