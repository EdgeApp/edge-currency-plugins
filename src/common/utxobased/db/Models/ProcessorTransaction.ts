import { Transaction } from 'altcoin-js'
import BN from 'bn.js'
import { EdgeTransaction } from 'edge-core-js/types'

import { PluginInfo } from '../../../plugin/types'
import { UTXOPluginWalletTools } from '../../engine/makeUtxoWalletTools'
import { UtxoTxOtherParams } from '../../engine/types'
import { Processor } from '../makeProcessor'
import { IProcessorTransaction } from '../types'

export const fromEdgeTransaction = (
  tx: EdgeTransaction
): IProcessorTransaction => {
  const otherParams = tx.otherParams as UtxoTxOtherParams
  if (otherParams == null) throw new Error('Invalid transaction data')
  if (otherParams.psbt == null)
    throw new Error('Missing PSBT in edge transaction data')

  /**
   * [1]: Buffer.from is necessary because Buffers are converted to Uint8Arrays
   * after through passing the bridge.
   */
  const inputs = otherParams.psbt.inputs.map((input, n) => ({
    amount: input.value.toString(),
    scriptPubkey: Buffer.from(input.scriptPubkey).toString('hex'), // [1]
    n,
    txId: Buffer.from(input.hash).reverse().toString('hex'), // [1]
    outputIndex: input.index
  }))
  const outputs = otherParams.psbt.outputs.map((output, n) => ({
    amount: output.value.toString(),
    scriptPubkey: Buffer.from(output.scriptPubkey).toString('hex'), // [1]
    n
  }))

  return {
    txid: tx.txid,
    hex: tx.signedTx,
    blockHeight: tx.blockHeight,
    date: tx.date,
    fees: tx.networkFee,
    inputs: inputs,
    outputs: outputs,
    // We can leave ourIns/ourOuts blank because they'll be updated by the
    // processor when receiving the transaction from blockbook.
    // We may want to calculate these preemptively, but for now this will work.
    ourIns: [],
    ourOuts: [],
    ourAmount: tx.nativeAmount ?? '0'
  }
}

interface ToEdgeTransactionArgs {
  walletId: string
  tx: IProcessorTransaction
  walletTools: UTXOPluginWalletTools
  processor: Processor
  pluginInfo: PluginInfo
}

export const toEdgeTransaction = async (
  args: ToEdgeTransactionArgs
): Promise<EdgeTransaction> => {
  const { tx, processor, walletTools, pluginInfo, walletId } = args
  const { currencyInfo } = pluginInfo
  const ourReceiveAddresses: string[] = []
  for (const out of tx.ourOuts) {
    const { scriptPubkey } = tx.outputs[parseInt(out)]
    const address = await processor.fetchAddress(scriptPubkey)

    if (address?.path != null) {
      const { address: addrStr } = walletTools.scriptPubkeyToAddress({
        changePath: address.path,
        scriptPubkey
      })
      ourReceiveAddresses.push(addrStr)
    }
  }

  const feeRes = {}

  try {
    const altcoinTx = Transaction.fromHex(tx.hex)
    const vBytes = altcoinTx.virtualSize()
    // feeRate must be of a number type (limited to 53 bits)
    const feeRate: number = new BN(tx.fees, 10)
      .div(new BN(vBytes, 10))
      .toNumber()
    Object.assign(feeRes, {
      feeRateUsed: {
        // GUI repo uses satPerVByte rather than satPerByte defined in customFeeTemplate
        satPerVByte: feeRate
      }
    })
  } catch (e) {}

  return {
    walletId,
    currencyCode: currencyInfo.currencyCode,
    txid: tx.txid,
    blockHeight: tx.blockHeight,
    confirmations: tx.confirmations,
    date: tx.date,
    nativeAmount: tx.ourAmount,
    networkFee: tx.fees,
    signedTx: tx.hex,
    ourReceiveAddresses,
    ...feeRes
  }
}
