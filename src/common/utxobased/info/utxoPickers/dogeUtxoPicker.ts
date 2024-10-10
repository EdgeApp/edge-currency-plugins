import {
  UtxoPicker,
  UtxoPickerArgs,
  UtxoPickerResult
} from '../../keymanager/utxopicker'
import { accumulative } from '../../keymanager/utxopicker/accumulative'
import { forceUseUtxo } from '../../keymanager/utxopicker/forceUseUtxo'
import { subtractFee } from '../../keymanager/utxopicker/subtractFee'

export function makeDogeUtxoPicker(): UtxoPicker {
  /*
  According to https://github.com/dogecoin/dogecoin/blob/master/doc/fee-recommendation.md
  the min fee rate is now 0.01 DOGE/kB which is 0.00001 DOGE/byte or 
  1,000 sats/vByte .
  */
  const minRelayFeeRate = 1000

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
