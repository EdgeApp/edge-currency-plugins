import { currencyFormatToPurposeType } from '../../engine/utils'
import {
  BIP43PurposeTypeEnum,
  ScriptTypeEnum
} from '../../keymanager/keymanager'
import { Processor } from '../makeProcessor'
import { IProcessorTransaction, IUTXO } from '../types'

export const utxoFromProcessorTransactionInput = async (
  processor: Processor,
  processorTransaction: IProcessorTransaction,
  inputIndex: number
): Promise<IUTXO> => {
  const input = processorTransaction.inputs[inputIndex]
  const { scriptPubkey } = input
  const address = await processor.fetchAddress(scriptPubkey)

  if (address == null)
    throw new Error(`Cannot find address for ${scriptPubkey}`)
  if (address.path == null)
    throw new Error(`Address has no derivation path information`)

  // Optional redeemScript for "our addresses"
  const redeemScript = address.redeemScript

  const purposeType = currencyFormatToPurposeType(address.path.format)
  const getScripts = async (
    scriptPubkey: string
  ): Promise<{
    script: string
    scriptType: ScriptTypeEnum
  }> => {
    switch (purposeType) {
      case BIP43PurposeTypeEnum.Airbitz:
      case BIP43PurposeTypeEnum.Legacy: {
        return {
          script: processorTransaction.hex,
          scriptType:
            redeemScript != null ? ScriptTypeEnum.p2sh : ScriptTypeEnum.p2pkh
        }
      }
      case BIP43PurposeTypeEnum.WrappedSegwit:
        return {
          script: scriptPubkey,
          scriptType: ScriptTypeEnum.p2wpkhp2sh
        }
      case BIP43PurposeTypeEnum.Segwit:
        return {
          script: scriptPubkey,
          scriptType: ScriptTypeEnum.p2wpkh
        }
      default:
        throw new Error(`Unknown purpose type ${purposeType}`)
    }
  }
  const { script, scriptType } = await getScripts(scriptPubkey)

  return {
    id: `${input.txId}_${input.outputIndex}`,
    txid: input.txId,
    vout: input.outputIndex,
    value: input.amount,
    scriptPubkey,
    script,
    redeemScript,
    scriptType,
    blockHeight: processorTransaction.blockHeight,
    spent: true
  }
}
