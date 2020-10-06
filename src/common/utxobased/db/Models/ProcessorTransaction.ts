import * as bs from 'biggystring'
import { EdgeTransaction } from 'edge-core-js/lib/types'

export interface IProcessorTransaction {
  txid: string
  blockHeight: number
  date: number
  fees: string
  inputs: ITransactionInput[]
  outputs: ITransactionOutput[]
  ourIns: number[]
  ourOuts: number[]
  ourAmount: string
}

export interface ITransactionOutput {
  amount: string
  scriptPubKey: string
}
export interface ITransactionInput extends ITransactionOutput {
  txId: string
  outputIndex: number
}

export class ProcessorTransaction implements IProcessorTransaction {
  public txid: string
  public blockHeight: number
  public date: number
  public fees: string
  public inputs: ITransactionInput[]
  public outputs: ITransactionOutput[]
  public ourIns: number[]
  public ourOuts: number[]
  public ourAmount: string

  constructor(data: IProcessorTransaction) {
    this.txid = data.txid
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

  public addOurIns(index: number) {
    const set = new Set(this.ourIns)
    if (set.has(index)) return

    set.add(index)
    this.ourIns = Array.from(set)

    this.ourAmount = bs.sub(this.ourAmount, this.inputs[index].amount)
  }

  public addOurOuts(index: number) {
    const set = new Set(this.ourOuts)
    if (set.has(index)) return

    set.add(index)
    this.ourOuts = Array.from(set)

    this.ourAmount = bs.add(this.ourAmount, this.outputs[index].amount)
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
        inputs: this.inputs,
        outputs: this.outputs,
        ourIns: this.ourIns,
        ourOuts: this.ourOuts
      }
    }
  }
}
