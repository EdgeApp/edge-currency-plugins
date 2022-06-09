import { EngineInfo } from '../../../plugin/types'
import { Processor } from '../../db/makeProcessor'
import { IProcessorTransaction, IUTXO } from '../../db/types'
import { BIP43PurposeTypeEnum } from '../../keymanager/keymanager'
import {
  currencyFormatToPurposeType,
  getScriptTypeFromPurposeType
} from '../utils'

export const getOwnUtxosFromTx = async (
  engineInfo: EngineInfo,
  processor: Processor,
  tx: IProcessorTransaction
): Promise<IUTXO[]> => {
  const utxos: IUTXO[] = []
  for (const output of tx.outputs) {
    const scriptPubkey = output.scriptPubkey
    const address = await processor.fetchAddress(scriptPubkey)
    if (address != null) {
      const id = `${tx.txid}_${output.n}`
      const path = address.path
      if (path != null) {
        const redeemScript = address.redeemScript
        const purposeType = currencyFormatToPurposeType(path.format)

        const isAirbitzOrLegacy = [
          BIP43PurposeTypeEnum.Airbitz,
          BIP43PurposeTypeEnum.Legacy
        ].includes(purposeType)

        const scriptType = getScriptTypeFromPurposeType(
          purposeType,
          redeemScript,
          engineInfo.scriptTemplates
        )
        const script = isAirbitzOrLegacy ? tx.hex : address.scriptPubkey
        const utxo: IUTXO = {
          id,
          txid: tx.txid,
          vout: output.n,
          value: output.amount,
          scriptPubkey,
          script,
          redeemScript,
          scriptType,
          blockHeight: tx.blockHeight,
          spent: false
        }
        utxos.push(utxo)
      }
    }
  }
  return utxos
}
