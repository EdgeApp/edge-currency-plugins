import { PsbtInput } from 'bip174/src/lib/interfaces'

import { ScriptTypeEnum } from '../keymanager'

export type Input = UTXO
export interface UTXO extends PsbtInput {
  hash: Buffer
  index: number
  sequence?: number
  value: number
  script: Buffer
  scriptPubkey: Buffer
  scriptType: ScriptTypeEnum
}

export interface Output {
  script: Buffer
  scriptPubkey: Buffer
  scriptType?: ScriptTypeEnum
  value: number
}

export interface Target {
  script: string
  value: number
}

export interface UtxoPickerArgs {
  utxos: UTXO[]
  useUtxos?: UTXO[]
  targets: Target[]
  feeRate: number
  changeScript: string
}

export interface UtxoPickerResult {
  inputs?: Input[]
  outputs?: Output[]
  changeUsed: boolean
  fee: number
}

export type UtxoPickingFunc = (args: UtxoPickerArgs) => UtxoPickerResult
