import { EdgeSpendInfo } from 'edge-core-js/types'

import { Input } from '../keymanager/utxopicker/types'

export interface UTXOTxOtherParams {
  psbt: {
    base64: string
    inputs: Input[]
  }
  edgeSpendInfo: EdgeSpendInfo
}
