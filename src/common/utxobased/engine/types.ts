import {
  asArray,
  asBoolean,
  asMaybe,
  asNumber,
  asObject,
  asOptional,
  asString,
  asValue
} from 'cleaners'
import { EdgeSpendInfo } from 'edge-core-js/types'

import { asTxOptions } from '../../plugin/types'
import { asUtxoSignatureFormat } from '../keymanager/types'
import { PsbtInputJson, PsbtOutputJson } from '../keymanager/utxopicker/types'

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
    // Amounts are decimal strings here, not bigint. This object is published
    // on `EdgeTransaction.otherParams`, which is a `JsonObject` and crosses the
    // edge-core-js bridge in both directions; neither JSON nor the bridge can
    // carry a bigint.
    inputs: PsbtInputJson[]
    outputs: PsbtOutputJson[]
  }
  edgeSpendInfo?: EdgeSpendInfo
  ourScriptPubkeys: string[]
  replacedTxid?: string
}

export type UtxoSignMessageOtherParams = ReturnType<
  typeof asUtxoSignMessageOtherParams
>
export const asUtxoSignMessageOtherParams = asObject({
  publicAddress: asString,
  // Defaults to the legacy Electrum encoding so existing callers keep the
  // format they already produce. BIP-137 is opt-in, since emitting a BIP-137
  // header to a verifier expecting the legacy one is just as broken as the
  // reverse.
  signatureFormat: asMaybe(asUtxoSignatureFormat, 'electrum')
})

const asOutputSort = asValue('bip69', 'targets')

export type UtxoSpendInfoOtherParams = ReturnType<
  typeof asUtxoSpendInfoOtherParams
>
export const asUtxoSpendInfoOtherParams = asObject({
  /** @deprecated use `EdgeSpendInfo['enableRbf']` */
  enableRbf: asOptional(asBoolean),
  forceChangeAddress: asOptional(asString),
  memoIndex: asOptional(asNumber),
  outputSort: asOptional(asOutputSort, 'bip69'),
  txOptions: asOptional(asTxOptions),
  utxoSourceAddress: asOptional(asString)
})
