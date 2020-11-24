import { EdgeTransaction } from 'edge-core-js/lib/types'

import { IProcessorTransaction, ITransactionInput, ITransactionOutput } from '../types'

export class ProcessorTransaction implements IProcessorTransaction {
  public txid: string
  public hex: string
  public blockHeight: number
  public date: number
  public fees: string
  public inputs: ITransactionInput[]
  public outputs: ITransactionOutput[]
  public ourIns: string[]
  public ourOuts: string[]
  public ourAmount: string

  constructor(data: IProcessorTransaction) {
    this.txid = data.txid
    this.hex = data.hex
    this.blockHeight = data.blockHeight
    this.date = data.date
    this.fees = data.fees
    this.inputs = data.inputs ?? []
    this.outputs = data.outputs ?? []
    this.ourIns = data.ourIns ?? []
    this.ourOuts = data.ourOuts ?? []
    this.ourAmount = data.ourAmount ?? '0'
  }

  public static fromEdgeTransaction(tx: EdgeTransaction): ProcessorTransaction {
    return new ProcessorTransaction({
      txid: tx.txid,
      hex: tx.otherParams?.hex,
      blockHeight: tx.blockHeight,
      date: tx.date,
      fees: tx.networkFee,
      inputs: tx.otherParams?.inputs,
      outputs: tx.otherParams?.outputs,
      ourIns: tx.otherParams?.ourIns,
      ourOuts: tx.otherParams?.ourOuts,
      ourAmount: tx.nativeAmount
    })
  }

  public toEdgeTransaction(currencyCode: string): EdgeTransaction {
    return {
      currencyCode,
      txid: this.txid,
      blockHeight: this.blockHeight,
      date: this.date,
      nativeAmount: this.ourAmount,
      networkFee: this.fees,
      signedTx: '',
      ourReceiveAddresses: [],
      otherParams: {
        hex: this.hex,
        inputs: this.inputs,
        outputs: this.outputs,
        ourIns: this.ourIns,
        ourOuts: this.ourOuts
      }
    }
  }
}
