import { PsbtInput } from 'bip174/src/lib/interfaces'
import { ScriptTypeEnum } from '../keymanager'

export type Input = UTXO
export interface UTXO extends PsbtInput {
  hash: Buffer
  index: number
  sequence?: number
  value: number
  script: Buffer
  scriptType: ScriptTypeEnum
}

export interface Output {
  script: Buffer
  scriptType?: ScriptTypeEnum
  value: number
}

export interface Target {
  script: string
  value: number
}

export interface Result {
  inputs?: UTXO[]
  outputs?: Output[]
  changeUsed?: boolean
  fee: number
}
