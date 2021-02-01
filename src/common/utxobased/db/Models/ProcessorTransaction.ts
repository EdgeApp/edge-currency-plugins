import { EdgeTransaction } from 'edge-core-js/lib/types'
import { IProcessorTransaction } from '../types'

export const toProcessorTransaction = (tx: EdgeTransaction): IProcessorTransaction => ({
  txid: tx.txid,
  hex: tx.otherParams?.hex,
  blockHeight: tx.blockHeight,
  date: tx.date,
  fees: tx.networkFee,
  inputs: tx.otherParams?.inputs ?? [],
  outputs: tx.otherParams?.outputs ?? [],
  ourIns: tx.otherParams?.ourIns ?? [],
  ourOuts: tx.otherParams?.ourOuts ?? [],
  ourAmount: tx.nativeAmount ?? '0'
})

export const toEdgeTransaction = (tx: IProcessorTransaction, currencyCode: string): EdgeTransaction => ({
  currencyCode,
  txid: tx.txid,
  blockHeight: tx.blockHeight,
  date: tx.date,
  nativeAmount: tx.ourAmount,
  networkFee: tx.fees,
  signedTx: '',
  ourReceiveAddresses: [],
  otherParams: {
    hex: tx.hex,
    inputs: tx.inputs,
    outputs: tx.outputs,
    ourIns: tx.ourIns,
    ourOuts: tx.ourOuts
  }
})
