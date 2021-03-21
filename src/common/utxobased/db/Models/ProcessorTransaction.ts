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
): Promise<EdgeTransaction> => ({
  currencyCode: args.currencyCode,
  txid: args.tx.txid,
  blockHeight: args.tx.blockHeight,
  date: args.tx.date,
  nativeAmount: args.tx.ourAmount,
  networkFee: args.tx.fees,
  signedTx: args.tx.hex,
  ourReceiveAddresses: await Promise.all(
    args.tx.ourOuts.map(
      async (i: string) =>
        args.walletTools.scriptPubkeyToAddress({
          scriptPubkey: args.tx.outputs[parseInt(i)].scriptPubkey,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          format: (await args.processor.fetchAddressByScriptPubkey(
            args.tx.outputs[parseInt(i)].scriptPubkey
          ))!.path!.format
        }).address
    )
  ),
  otherParams: {
    inputs: args.tx.inputs,
    outputs: args.tx.outputs,
    ourIns: args.tx.ourIns,
    ourOuts: args.tx.ourOuts
  }
})
