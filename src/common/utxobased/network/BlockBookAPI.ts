import { EdgeTransaction } from 'edge-core-js'

export interface PartialTask {
  method: string
  params: unknown
}

interface IAccountOpts {
  details?: string
  from?: number
  to?: number
  page?: number
  perPage?: number
}

export const pingMessage = (): PartialTask => {
  return {
    method: 'ping',
    params: undefined
  }
}

export const infoMessage = (): PartialTask => {
  return {
    method: 'getInfo',
    params: {}
  }
}

export const addressUtxosMessage = (account: string): PartialTask => {
  return {
    method: 'getAccountUtxo',
    params: { descriptor: account }
  }
}

export const transactionMessage = (hash: string): PartialTask => {
  return {
    method: 'getTransaction',
    params: { txid: hash }
  }
}

export const broadcastTxMessage = (
  transaction: EdgeTransaction
): PartialTask => {
  return {
    method: 'sendTransaction',
    params: { hex: transaction.signedTx }
  }
}

export const addressMessage = (
  address: string,
  opts: IAccountOpts = {}
): PartialTask => {
  opts = Object.assign(
    {},
    {
      details: 'basic',
      page: 1,
      perPage: 100
    },
    opts
  )
  return {
    method: 'getAccountInfo',
    params: {
      ...opts,
      descriptor: address
    }
  }
}

export const subscribeNewBlockMessage = (): PartialTask => {
  return {
    method: 'subscribeNewBlock',
    params: {}
  }
}

export const subscribeAddressesMessage = (addresses: string[]): PartialTask => {
  return {
    method: 'subscribeAddresses',
    params: { addresses }
  }
}
