import {
  UtxoPicker,
  UtxoPickerArgs,
  UtxoPickerResult
} from '../../keymanager/utxopicker'
import { accumulative } from '../../keymanager/utxopicker/accumulative'
import { forceUseUtxo } from '../../keymanager/utxopicker/forceUseUtxo'
import { subtractFee } from '../../keymanager/utxopicker/subtractFee'

export function makeDogeUtxoPicker(): UtxoPicker {
  // According to https://github.com/dogecoin/dogecoin/discussions/2347 the min fee rate is now 0.001 Doge per Kilobyte
  const minRelayFeeRate = 0.001 / 1000

  return {
    forceUseUtxo: (args: UtxoPickerArgs): UtxoPickerResult => {
      if (args.feeRate < minRelayFeeRate) {
        args.feeRate = minRelayFeeRate
      }
      return forceUseUtxo(args)
    },
    subtractFee: (args: UtxoPickerArgs): UtxoPickerResult => {
      if (args.feeRate < minRelayFeeRate) {
        args.feeRate = minRelayFeeRate
      }
      return subtractFee(args)
    },
    accumulative: (args: UtxoPickerArgs): UtxoPickerResult => {
      if (args.feeRate < minRelayFeeRate) {
        args.feeRate = minRelayFeeRate
      }
      return accumulative(args)
    }
  }
}
