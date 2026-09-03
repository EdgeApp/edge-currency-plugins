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
export interface PsbtInputJson extends Omit<Input, 'value'> {
  value: string
}
export interface PsbtOutputJson extends Omit<Output, 'value'> {
  value: string
}

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
