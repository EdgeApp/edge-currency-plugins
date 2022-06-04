import { asArray, asBoolean, asMaybe, asObject, asString } from 'cleaners'
import { EdgeSpendInfo } from 'edge-core-js/types'

import { Input, Output } from '../keymanager/utxopicker/types'

export const asUtxoUserSettings = asObject({
  blockbookServers: asMaybe(asArray(asString), []),
  enableCustomServers: asMaybe(asBoolean, false)
})
export type UtxoUserSettings = ReturnType<typeof asUtxoUserSettings>

export interface UtxoTxOtherParams {
  txJson?: { hex?: string }
  psbt?: {
    base64: string
    inputs: Input[]
    outputs: Output[]
  }
  edgeSpendInfo?: EdgeSpendInfo
  ourScriptPubkeys: string[]
}
