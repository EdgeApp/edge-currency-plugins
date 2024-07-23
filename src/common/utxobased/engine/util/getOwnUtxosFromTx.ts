import { EngineInfo } from '../../../plugin/types'
import { DataLayer } from '../../db/DataLayer'
import { TransactionData, UtxoData } from '../../db/types'
import { BIP43PurposeTypeEnum } from '../../keymanager/keymanager'
import { getScriptTypeFromPurposeType, pathToPurposeType } from '../utils'

export const getOwnUtxosFromTx = async (
  engineInfo: EngineInfo,
  dataLayer: DataLayer,
  tx: TransactionData
): Promise<UtxoData[]> => {
  const ownUtxos: UtxoData[] = []

  //
  // Spent UTXOs (Inputs)
  //

  const inputUtxoIds = tx.inputs.map(
    input => `${input.txId}_${input.outputIndex}`
  )
  const inputUtxos = await dataLayer.fetchUtxos({
    utxoIds: inputUtxoIds
  })
  for (const utxo of inputUtxos) {
    if (utxo == null) continue
    // Must create a new UtxoData object when mutating DataLayer objects because
    // memlet may keep a reference in memory.
    ownUtxos.push({ ...utxo, spent: true })
  }

  //
  // Unspent UTXOs (Outputs)
  //

  for (const output of tx.outputs) {
    const scriptPubkey = output.scriptPubkey
    const address = await dataLayer.fetchAddress(scriptPubkey)
    if (address != null) {
      const id = `${tx.txid}_${output.n}`
      const path = address.path
      if (path != null) {
        const redeemScript = address.redeemScript
        const purposeType = pathToPurposeType(path, engineInfo.scriptTemplates)

        const isAirbitzOrLegacy = [
          BIP43PurposeTypeEnum.Airbitz,
          BIP43PurposeTypeEnum.Legacy,
          BIP43PurposeTypeEnum.ReplayProtection
        ].includes(purposeType)

        const scriptType = getScriptTypeFromPurposeType(purposeType)
        const script = isAirbitzOrLegacy ? tx.hex : address.scriptPubkey
        const utxo: UtxoData = {
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
        ownUtxos.push(utxo)
      }
    }
  }

  return ownUtxos
}
