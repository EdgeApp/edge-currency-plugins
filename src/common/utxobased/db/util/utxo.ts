import { currencyFormatToPurposeType } from '../../engine/utils'
import {
  BIP43PurposeTypeEnum,
  ScriptTypeEnum
} from '../../keymanager/keymanager'
import { DataLayer } from '../DataLayer'
import { TransactionData, UtxoData } from '../types'

export const utxoFromTransactionDataInput = async (
  dataLayer: DataLayer,
  transactionData: TransactionData,
  inputIndex: number
): Promise<UtxoData> => {
  const input = transactionData.inputs[inputIndex]
  const address = await dataLayer.fetchAddress(input.scriptPubkey)

  if (address == null)
    throw new Error(`Cannot find address for ${input.scriptPubkey}`)
  if (address.path == null)
    throw new Error(`Address has no derivation path information`)

  // Optional redeemScript for "our addresses"
  const redeemScript = address.redeemScript

  const purposeType = currencyFormatToPurposeType(address.path.format)
  const getScripts = async (): Promise<{
    script: string
    scriptType: ScriptTypeEnum
  }> => {
    switch (purposeType) {
      case BIP43PurposeTypeEnum.Airbitz:
      case BIP43PurposeTypeEnum.Legacy: {
        return {
          script: transactionData.hex,
          scriptType:
            redeemScript != null ? ScriptTypeEnum.p2sh : ScriptTypeEnum.p2pkh
        }
      }
      case BIP43PurposeTypeEnum.WrappedSegwit:
        return {
          script: input.scriptPubkey,
          scriptType: ScriptTypeEnum.p2wpkhp2sh
        }
      case BIP43PurposeTypeEnum.Segwit:
        return {
          script: input.scriptPubkey,
          scriptType: ScriptTypeEnum.p2wpkh
        }
      default:
        throw new Error(`Unknown purpose type ${purposeType}`)
    }
  }
  const { script, scriptType } = await getScripts()

  return {
    id: `${input.txId}_${input.outputIndex}`,
    txid: input.txId,
    vout: input.outputIndex,
    value: input.amount,
    scriptPubkey: input.scriptPubkey,
    script,
    redeemScript,
    scriptType,
    blockHeight: transactionData.blockHeight,
    spent: true
  }
}
