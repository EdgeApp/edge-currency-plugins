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
  txId: string
  index: number
  value: string
  scriptPubKey: string
  blockHeight: number
}
