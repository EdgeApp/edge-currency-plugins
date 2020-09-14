export interface IUTXO {
  id: string
  txId: string
  index: number
  value: string
  scriptPubKey: string
  blockHeight: number
}

export class UTXO implements IUTXO {
  public id: string
  public txId: string
  public index: number
  public value: string
  public scriptPubKey: string
  public blockHeight: number

  constructor(data: Omit<IUTXO, 'id'>) {
    this.id = `${data.txId}_${data.index}`
    this.txId = data.txId
    this.index = data.index
    this.value = data.value
    this.scriptPubKey = data.scriptPubKey
    this.blockHeight = data.blockHeight
  }
}
