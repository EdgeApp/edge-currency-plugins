export type IAddress = Required<IAddressPartial>
export interface IAddressPartial extends IAddressRequired, IAddressOptional {}
export interface IAddressRequired {
  scriptPubKey: string
  networkQueryVal: number
  path: string
}
export interface IAddressOptional {
  lastQuery?: number
  lastTouched?: number
  used?: boolean
  balance?: string
}

export interface IUTXO {
  id: string
  txid: string
  vout: number
  value: string
  scriptPubKey: string
  scriptSig?: string
  redeemScript?: string
  isSegwit: boolean
  blockHeight: number
}

export interface IProcessorTransaction {
  txid: string
  hex: string
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
