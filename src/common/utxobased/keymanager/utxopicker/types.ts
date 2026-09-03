import { PsbtInput } from 'altcoin-js'

import { ScriptTypeEnum } from '../keymanager'

export type Input = UTXO
export interface UTXO extends PsbtInput {
  hash: Buffer
  index: number
  sequence: number
  value: bigint
  script: Buffer
  scriptPubkey: Buffer
  scriptType: ScriptTypeEnum
}

export interface Output {
  script: Buffer
  scriptPubkey: Buffer
  value: bigint
}

export interface Target {
  script: string
  value: bigint
}

/**
 * The JSON-safe forms of `Input` and `Output`, carrying amounts as decimal
 * strings.
 *
 * These are what gets published in `EdgeTransaction.otherParams`. That object
 * is typed `JsonObject` and crosses the edge-core-js bridge, which has no
 * representation for `bigint` — `JSON.stringify` throws on one outright — so
 * the internal `bigint` forms above must never be put there directly.
 */
export interface PsbtInputJson extends Omit<Input, 'value' | 'witnessUtxo'> {
  value: string
  // `PsbtInput.witnessUtxo.value` is a bigint too, inherited from bip174. It is
  // easy to miss because it is nested a level deeper than the amount above.
  witnessUtxo?: { script: Uint8Array; value: string }
}
export interface PsbtOutputJson extends Omit<Output, 'value'> {
  value: string
}

export const toPsbtInputJson = (input: Input): PsbtInputJson => ({
  ...input,
  value: input.value.toString(),
  witnessUtxo:
    input.witnessUtxo == null
      ? undefined
      : {
          script: input.witnessUtxo.script,
          value: input.witnessUtxo.value.toString()
        }
})
export const toPsbtOutputJson = (output: Output): PsbtOutputJson => ({
  ...output,
  value: output.value.toString()
})

export interface UtxoPickerArgs {
  utxos: UTXO[]
  useUtxos?: UTXO[]
  targets: Target[]
  feeRate: number
  changeScript: string
}

export interface UtxoPickerResult {
  inputs: Input[]
  // Nullish outputs means fee exceeds selected inputs
  outputs?: Output[]
  changeUsed: boolean
  fee: bigint
}

export type UtxoPickingFunc = (args: UtxoPickerArgs) => UtxoPickerResult
