import {
  asArray,
  asBoolean,
  asEither,
  asNumber,
  asObject,
  asOptional,
  asString
} from 'cleaners'
import { EdgeTransaction } from 'edge-core-js/types'

/**
 * Websocket Task
 */
export interface PartialTask {
  method: string
  params: unknown
}

/**
 * Ping Message
 */
export const pingMessage = (): PartialTask => {
  return {
    method: 'ping',
    params: undefined
  }
}

/**
 * Get Info
 */
export const infoMessage = (): PartialTask => {
  return {
    method: 'getInfo',
    params: {}
  }
}
export type IServerInfo = ReturnType<typeof asIServerInfo>
export const asIServerInfo = asObject({
  name: asString,
  shortcut: asString,
  decimals: asNumber,
  version: asString,
  bestHeight: asNumber,
  bestHash: asString,
  block0Hash: asString,
  testnet: asBoolean,
  backend: asOptional(
    asObject({
      version: asString,
      subversion: asString
    })
  )
})

/**
 * Get Account UTXO
 */
export const addressUtxosMessage = (account: string): PartialTask => {
  return {
    method: 'getAccountUtxo',
    params: { descriptor: account }
  }
}
export const asAddressUtxo = asObject({
  txid: asString,
  vout: asNumber,
  value: asString,
  confirmations: asNumber,
  coinbase: asOptional(asBoolean),
  height: asOptional(asNumber),
  lockTime: asOptional(asNumber),
  address: asOptional(asString),
  path: asOptional(asString)
})
export const asAddressUtxos = asArray(asAddressUtxo)

/**
 * Get Transaction
 */
export const transactionMessage = (hash: string): PartialTask => {
  return {
    method: 'getTransaction',
    params: { txid: hash }
  }
}
export type ITransaction = ReturnType<typeof asITransaction>
export const asITransaction = asObject({
  txid: asString,
  hex: asString,
  blockHeight: asNumber,
  confirmations: asNumber,
  blockTime: asNumber,
  fees: asString,
  vin: asArray(
    asObject({
      txid: asString,
      sequence: asNumber,
      n: asNumber,
      vout: asOptional(asNumber, -1),
      addresses: asArray(asString),
      isAddress: asBoolean,
      value: asString,
      hex: asOptional(asString)
    })
  ),
  vout: asArray(
    asObject({
      n: asNumber,
      value: asString,
      addresses: asArray(asString),
      hex: asOptional(asString)
    })
  )
})

/**
 * Send Transaction
 */
export const broadcastTxMessage = (
  transaction: EdgeTransaction
): PartialTask => {
  return {
    method: 'sendTransaction',
    params: { hex: transaction.signedTx }
  }
}
export const asBlockbookErrorResponse = asObject({
  error: asObject({
    message: asString
  })
})
export const asBlockbookTxBroadcastSuccess = asObject({
  result: asString
})
export type BlockbookTxBroadcastResponse = ReturnType<
  typeof asBlockbookTxBroadcastResponse
>
export const asBlockbookTxBroadcastResponse = asEither(
  asBlockbookErrorResponse,
  asBlockbookTxBroadcastSuccess
)

/**
 * Get Account Info
 */
interface IAccountOpts {
  details?: string
  from?: number
  to?: number
  page?: number
  perPage?: number
}
export const addressMessage = (
  address: string,
  opts: IAccountOpts = {}
): PartialTask => {
  return {
    method: 'getAccountInfo',
    params: {
      ...{ details: 'basic', page: 1, perPage: 100, ...opts },
      descriptor: address
    }
  }
}

/**
 * Subscribe New Block
 */
export const subscribeNewBlockMessage = (): PartialTask => {
  return {
    method: 'subscribeNewBlock',
    params: {}
  }
}
export type INewBlockResponse = ReturnType<typeof asINewBlockResponse>
export const asINewBlockResponse = asObject({
  height: asNumber,
  hash: asString
})

/**
 * Subscribe Address
 */
export const subscribeAddressesMessage = (addresses: string[]): PartialTask => {
  return {
    method: 'subscribeAddresses',
    params: { addresses }
  }
}
export type INewTransactionResponse = ReturnType<
  typeof asINewTransactionResponse
>
export const asINewTransactionResponse = asObject({
  address: asString,
  tx: asITransaction
})
