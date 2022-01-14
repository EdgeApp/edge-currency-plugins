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
export interface BlockbookTask {
  method: string
  params: unknown
}

// ---------------------------------------------------------------------
// Blockbook Types
// ---------------------------------------------------------------------

export type BlockbookTransaction = ReturnType<typeof asBlockbookTransaction>
export const asBlockbookTransaction = asObject({
  txid: asString,
  hex: asString,
  blockHeight: asNumber,
  confirmations: asNumber,
  blockTime: asNumber,
  fees: asString,
  vin: asArray(
    asObject({
      txid: asString,
      sequence: asOptional(asNumber),
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

// ---------------------------------------------------------------------
// Blockbook API Messages
// ---------------------------------------------------------------------

/**
 * Ping Message
 */
export const pingMessage = (): BlockbookTask => {
  return {
    method: 'ping',
    params: undefined
  }
}

/**
 * Get Info
 */
export const infoMessage = (): BlockbookTask => {
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
export const addressUtxosMessage = (account: string): BlockbookTask => {
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
export const transactionMessage = (hash: string): BlockbookTask => {
  return {
    method: 'getTransaction',
    params: { txid: hash }
  }
}
export type ITransaction = ReturnType<typeof asITransaction>
export const asITransaction = asBlockbookTransaction

/**
 * Send Transaction
 */
export const broadcastTxMessage = (
  transaction: EdgeTransaction
): BlockbookTask => {
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
export interface AddresssMessageParams {
  details?: 'basic' | 'txids' | 'txs'
  from?: number
  to?: number
  page?: number
  perPage?: number
}
export const addressMessage = (
  address: string,
  params: AddresssMessageParams = {}
): BlockbookTask => {
  return {
    method: 'getAccountInfo',
    params: {
      ...{ details: 'basic', page: 1, perPage: 100, ...params },
      descriptor: address
    }
  }
}
export type AddressResponse = ReturnType<typeof asAddressResponse>
export const asAddressResponse = asObject({
  // details: basic
  address: asString,
  balance: asString,
  totalReceived: asString,
  totalSent: asString,
  txs: asNumber,
  unconfirmedBalance: asString,
  unconfirmedTxs: asNumber,
  // details: txids
  txids: asOptional(asArray(asString), []),
  // details: txs
  transactions: asOptional(asArray(asBlockbookTransaction), []),
  // Pagination (included with txids and txs requests)
  page: asOptional(asNumber, NaN),
  totalPages: asOptional(asNumber, NaN),
  itemsOnPage: asOptional(asNumber, NaN)
})

/**
 * Subscribe New Block
 */
export const subscribeNewBlockMessage = (): BlockbookTask => {
  return {
    method: 'subscribeNewBlock',
    params: {}
  }
}
export type SubscribeNewBlockResponse = ReturnType<
  typeof asSubscribeNewBlockResponse
>
export const asSubscribeNewBlockResponse = asObject({
  height: asNumber,
  hash: asString
})

/**
 * Subscribe Address
 */
export const subscribeAddressesMessage = (
  addresses: string[]
): BlockbookTask => {
  return {
    method: 'subscribeAddresses',
    params: { addresses }
  }
}
export type SubscribeAddressResponse = ReturnType<
  typeof asSubscribeAddressResponse
>
export const asSubscribeAddressResponse = asObject({
  address: asString,
  tx: asBlockbookTransaction
})
