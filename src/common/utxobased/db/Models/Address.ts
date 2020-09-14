export type IAddress = Required<IAddressPartial>
export interface IAddressPartial extends IAddressRequired, IAddressOptional {}
export interface IAddressRequired {
  address: string
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

export class Address implements IAddress {
  public address: string
  public scriptPubKey: string
  public networkQueryVal: number
  public path: string
  public lastQuery: number
  public used: boolean
  public lastTouched: number
  public balance: string

  constructor(data: IAddress) {
    this.address = data.address
    this.scriptPubKey = data.scriptPubKey
    this.networkQueryVal = data.networkQueryVal
    this.path = data.path
    this.lastQuery = data.lastQuery
    this.used = data.used ?? false
    this.lastTouched = data.lastTouched ?? 0
    this.balance = data.balance ?? '0'
  }
}
