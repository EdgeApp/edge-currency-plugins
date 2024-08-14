import {
  asArray,
  asBoolean,
  asMaybe,
  asObject,
  asOptional,
  asString,
  asValue
} from 'cleaners'
import { EdgeSpendInfo } from 'edge-core-js/types'

import { asTxOptions } from '../../plugin/types'
import { Input, Output } from '../keymanager/utxopicker/types'

export interface UtxoInitOptions {
  nowNodesApiKey?: string
}
export const asUtxoInitOptions = asObject<UtxoInitOptions>({
  nowNodesApiKey: asOptional(asString)
})

export const asUtxoUserSettings = asObject({
  blockbookServers: asMaybe(asArray(asString), []),
  enableCustomServers: asMaybe(asBoolean, false)
})
export type UtxoUserSettings = ReturnType<typeof asUtxoUserSettings>

export interface UtxoTxOtherParams {
  unsignedTx: string // hex
  psbt?: {
    base64: string
    inputs: Input[]
    outputs: Output[]
  }
  edgeSpendInfo?: EdgeSpendInfo
  ourScriptPubkeys: string[]
  replacedTxid?: string
}

export type UtxoSignMessageOtherParams = ReturnType<
  typeof asUtxoSignMessageOtherParams
>
export const asUtxoSignMessageOtherParams = asObject({
  publicAddress: asString
})

const asOutputSort = asValue('bip69', 'targets')

export type UtxoSpendInfoOtherParams = ReturnType<
  typeof asUtxoSpendInfoOtherParams
>
export const asUtxoSpendInfoOtherParams = asObject({
  /** @deprecated use `EdgeSpendInfo['enableRbf']` */
  enableRbf: asOptional(asBoolean),
  forceChangeAddress: asOptional(asString),
  outputSort: asOptional(asOutputSort, 'bip69'),
  txOptions: asOptional(asTxOptions),
  utxoSourceAddress: asOptional(asString)
})
