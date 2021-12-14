import { EdgeTransaction } from 'edge-core-js/types'

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
    scriptPubkey: Buffer.from(input.script).toString('hex'), // [1]
    n,
    txId: Buffer.from(input.hash).reverse().toString('hex'), // [1]
    outputIndex: input.index
  }))
  const outputs = otherParams.psbt.outputs.map((input, n) => ({
    amount: input.value.toString(),

    scriptPubkey: Buffer.from(input.script).toString('hex'), // [1]
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
  tx: IProcessorTransaction
  currencyCode: string
  walletTools: UTXOPluginWalletTools
  processor: Processor
}

export const toEdgeTransaction = async (
  args: ToEdgeTransactionArgs
): Promise<EdgeTransaction> => {
  const { tx, processor, walletTools } = args

  const ourReceiveAddresses: string[] = []
  for (const out of tx.ourOuts) {
    const { scriptPubkey } = tx.outputs[parseInt(out)]
    const address = await processor.fetchAddress(scriptPubkey)
    if (address?.path != null) {
      const { address: addrStr } = walletTools.scriptPubkeyToAddress({
        scriptPubkey,
        format: address.path.format
      })
      ourReceiveAddresses.push(addrStr)
    }
  }

  return {
    currencyCode: args.currencyCode,
    txid: args.tx.txid,
    blockHeight: args.tx.blockHeight,
    date: args.tx.date,
    nativeAmount: args.tx.ourAmount,
    networkFee: args.tx.fees,
    signedTx: args.tx.hex,
    ourReceiveAddresses
  }
}
