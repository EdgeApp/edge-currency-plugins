import { accumulative } from './utxopicker/accumulative'
import { forceUseUtxo } from './utxopicker/forceUseUtxo'
import { subtractFee } from './utxopicker/subtractFee'
import { UtxoPickingFunc } from './utxopicker/types'
export * from './utxopicker/types'

export interface UtxoPicker {
  forceUseUtxo: UtxoPickingFunc
  subtractFee: UtxoPickingFunc
  accumulative: UtxoPickingFunc
}

export const utxoPicker: UtxoPicker = {
  forceUseUtxo,
  subtractFee,
  accumulative
}
