import { EdgeTransaction } from 'edge-core-js'

import { UTXOPluginWalletTools } from '../../engine/makeUtxoWalletTools'
import { Processor } from '../makeProcessor'
import { IProcessorTransaction } from '../types'

export const fromEdgeTransaction = (
  tx: EdgeTransaction
): IProcessorTransaction => ({
  txid: tx.txid,
  hex: tx.signedTx,
  blockHeight: tx.blockHeight,
  date: tx.date,
  fees: tx.networkFee,
  inputs: tx.otherParams?.inputs ?? [],
  outputs: tx.otherParams?.outputs ?? [],
  ourIns: tx.otherParams?.ourIns ?? [],
  ourOuts: tx.otherParams?.ourOuts ?? [],
  ourAmount: tx.nativeAmount ?? '0'
})

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
    ourReceiveAddresses,
    otherParams: {
      inputs: args.tx.inputs,
      outputs: args.tx.outputs,
      ourIns: args.tx.ourIns,
      ourOuts: args.tx.ourOuts
    }
  }
}
