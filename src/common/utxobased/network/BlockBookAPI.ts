import {
  asArray,
  asBoolean,
  asMaybe,
  asNumber,
  asObject,
  asOptional,
  asString,
  Cleaner
} from 'cleaners'
import { EdgeTransaction } from 'edge-core-js/types'

/**
 * Websocket Task
 */
export interface BlockbookTask<T> {
  method: string
  params: unknown
  cleaner: Cleaner<T>
}

// ---------------------------------------------------------------------
// Blockbook Types
// ---------------------------------------------------------------------

export interface BlockbookAccountUtxo {
  txid: string
  vout: number
  value: string
  confirmations?: number
  coinbase?: boolean
  height?: number
  lockTime?: number
  address?: string
  path?: string
}
export const asBlockbookAccountUtxo: Cleaner<BlockbookAccountUtxo> = asObject({
  txid: asString,
  vout: asNumber,
  value: asString,
  confirmations: asOptional(asNumber),
  coinbase: asOptional(asBoolean),
  height: asOptional(asNumber),
  lockTime: asOptional(asNumber),
  address: asOptional(asString),
  path: asOptional(asString)
})

export interface BlockbookTransaction {
  txid: string
  hex: string
  blockHeight: number
  confirmations: number
  blockTime: number
  fees: string
  vin: Array<{
    txid: string
    sequence?: number
    n: number
    vout: number
    addresses: string[]
    isAddress: boolean
    value: string
    hex?: string
  }>
  vout: Array<{
    n: number
    value: string
    addresses: string[]
    hex?: string
  }>
}
export const asBlockbookTransaction: Cleaner<BlockbookTransaction> = asObject({
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
// Blockbook API Response Types
// ---------------------------------------------------------------------

/**
 * Error Response
 */
export type BlockbookErrorResponse = ReturnType<typeof asBlockbookErrorResponse>
export const asBlockbookErrorResponse = asObject({
  error: asObject({
    message: asString
  })
})

/**
 * Blockbook Response Generic
 */
export type BlockbookResponse<T> = T
export const asBlockbookResponse = <T>(asT: Cleaner<T>): Cleaner<T> => raw => {
  const errResponse = asMaybe(asBlockbookErrorResponse)(raw)

  if (errResponse != null)
    throw new Error(`Blockbook Error: ${errResponse.error.message}`)

  return asT(raw)
}

// ---------------------------------------------------------------------
// Blockbook API Messages
// ---------------------------------------------------------------------

/**
 * Ping Message
 */
export const pingMessage = (): BlockbookTask<PingResponse> => {
  return {
    method: 'ping',
    params: undefined,
    cleaner: asBlockbookResponse(asPingResponse)
  }
}
export type PingResponse = ReturnType<typeof asPingResponse>
export const asPingResponse = asObject({})

/**
 * Get Info
 */
export const infoMessage = (): BlockbookTask<InfoResponse> => {
  return {
    method: 'getInfo',
    params: {},
    cleaner: asBlockbookResponse(asInfoResponse)
  }
}
export type InfoResponse = ReturnType<typeof asInfoResponse>
export const asInfoResponse = asObject({
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
export const addressUtxosMessage = (
  account: string
): BlockbookTask<AddressUtxosResponse> => {
  return {
    method: 'getAccountUtxo',
    params: { descriptor: account },
    cleaner: asBlockbookResponse(asAddressUtxosResponse)
  }
}
export type AddressUtxosResponse = ReturnType<typeof asAddressUtxosResponse>
export const asAddressUtxosResponse = asArray(asBlockbookAccountUtxo)

/**
 * Get Transaction
 */
export const transactionMessage = (
  hash: string
): BlockbookTask<TransactionResponse> => {
  return {
    method: 'getTransaction',
    params: { txid: hash },
    cleaner: asBlockbookResponse(asTransactionResponse)
  }
}
export type TransactionResponse = ReturnType<typeof asTransactionResponse>
export const asTransactionResponse = asBlockbookTransaction

/**
 * Send Transaction
 */
export const broadcastTxMessage = (
  transaction: EdgeTransaction
): BlockbookTask<BroadcastTxResponse> => {
  return {
    method: 'sendTransaction',
    params: { hex: transaction.signedTx },
    cleaner: asBlockbookResponse(asBroadcastTxResponse)
  }
}
export type BroadcastTxResponse = ReturnType<typeof asBroadcastTxResponse>
export const asBroadcastTxResponse = asObject({
  result: asString
})

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
): BlockbookTask<AddressResponse> => {
  return {
    method: 'getAccountInfo',
    params: {
      ...{ details: 'basic', page: 1, perPage: 100, ...params },
      descriptor: address
    },
    cleaner: asBlockbookResponse(asAddressResponse)
  }
}
export interface AddressResponse {
  address: string
  balance: string
  totalReceived: string
  totalSent: string
  txs: number
  unconfirmedBalance: string
  unconfirmedTxs: number
  txids: string[]
  transactions: BlockbookTransaction[]
  page: number
  totalPages: number
  itemsOnPage: number
}
export const asAddressResponse: Cleaner<AddressResponse> = asObject({
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
export const subscribeNewBlockMessage = (): BlockbookTask<SubscribeNewBlockResponse> => {
  return {
    method: 'subscribeNewBlock',
    params: {},
    cleaner: asBlockbookResponse(asSubscribeNewBlockResponse)
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
): BlockbookTask<SubscribeAddressResponse> => {
  return {
    method: 'subscribeAddresses',
    params: { addresses },
    cleaner: asBlockbookResponse(asSubscribeAddressResponse)
  }
}
export type SubscribeAddressResponse = ReturnType<
  typeof asSubscribeAddressResponse
>
export const asSubscribeAddressResponse = asObject({
  address: asString,
  tx: asBlockbookTransaction
})
