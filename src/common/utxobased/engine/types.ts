import { EdgeSpendInfo } from 'edge-core-js/types'

import { Input, Output } from '../keymanager/utxopicker/types'

export interface UtxoTxOtherParams {
  psbt?: {
    base64: string
    inputs: Input[]
    outputs: Output[]
  }
  edgeSpendInfo?: EdgeSpendInfo
  ourScriptPubkeys: string[]
}
