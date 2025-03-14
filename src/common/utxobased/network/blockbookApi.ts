import {
  asArray,
  asBoolean,
  asMaybe,
  asNumber,
  asObject,
  asOptional,
  asString,
  asUnknown,
  Cleaner,
  uncleaner
} from 'cleaners'

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
export const asBlockbookAccountUtxo = (
  asAddress: Cleaner<string> = asString
): Cleaner<BlockbookAccountUtxo> =>
  asObject({
    txid: asString,
    vout: asNumber,
    value: asString,
    confirmations: asOptional(asNumber),
    coinbase: asOptional(asBoolean),
    height: asOptional(asNumber),
    lockTime: asOptional(asNumber),
    address: asOptional(asAddress),
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
    addresses: string[]
    isAddress: boolean
    n: number
    sequence: number
    txid?: string
    value: string
    vout: number
    coinbase?: string
    isOwn?: boolean
    hex?: string
    asm?: string
  }>
  vout: Array<{
    n: number
    value: string
    addresses: string[]
    hex?: string
  }>
}
export const asBlockbookTransaction = (
  asAddress: Cleaner<string> = asString
): Cleaner<BlockbookTransaction> =>
  asObject({
    txid: asString,
    hex: asString,
    blockHeight: asNumber,
    confirmations: asNumber,
    blockTime: asNumber,
    fees: asString,
    vin: asArray(
      asObject({
        addresses: asOptional(asArray(asString), () => []),
        // `isAddress` is a boolean flag that indicates whether the input is an address.
        // And therefore has `addresses` field. If `isAddress` is false, then the input is likely a coinbase input.
        isAddress: asBoolean,
        // This is the index of the input. Not to be confused with the index of the previous output (vout).
        n: asNumber,
        // Empirically observed omitted sequence is possible for when sequence is zero.
        // Is the case for tx `19ecc679cfc7e71ad616a22bbee96fd5abe8616e4f408f1f5daaf137400ae091`.
        sequence: asOptional(asNumber, 0),
        txid: asOptional(asString),
        value: asOptional(asString, '0'),
        // If Blockbook doesn't provide vout, assume 0. Empirically observed
        // case for tx `fefac8c22ba1178df5d7c90b78cc1c203d1a9f5f5506f7b8f6f469fa821c2674`
        // which has no `vout` for input in WebSocket response payload but block
        // will show the input's vout value to be `0`.
        vout: asOptional(asNumber, 0),
        coinbase: asOptional(asString),
        isOwn: asOptional(asBoolean),
        hex: asOptional(asString),
        asm: asOptional(asString)
      })
    ),
    vout: asArray(
      asObject({
        n: asNumber,
        value: asString,
        addresses: asArray(asAddress),
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
  backend: asMaybe(
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
  address: string,
  asAddress: Cleaner<string> = asString
): BlockbookTask<AddressUtxosResponse> => {
  const wasAddress = uncleaner(asAddress)
  return {
    method: 'getAccountUtxo',
    params: { descriptor: wasAddress(address) },
    cleaner: asBlockbookResponse(asAddressUtxosResponse(asAddress))
  }
}
export type AddressUtxosResponse = BlockbookAccountUtxo[]
export const asAddressUtxosResponse = (
  asAddress: Cleaner<string> = asString
): Cleaner<AddressUtxosResponse> => asArray(asBlockbookAccountUtxo(asAddress))

/**
 * Get Transaction
 */
export const transactionMessage = (
  hash: string,
  asAddress: Cleaner<string> = asString
): BlockbookTask<TransactionResponse> => ({
  method: 'getTransaction',
  params: { txid: hash },
  cleaner: asBlockbookResponse(asTransactionResponse(asAddress))
})
export type TransactionResponse = BlockbookTransaction
export const asTransactionResponse = asBlockbookTransaction

/**
 * Get Transaction Specific
 */
export const transactionMessageSpecific = (
  hash: string
): BlockbookTask<unknown> => ({
  method: 'getTransactionSpecific',
  params: { txid: hash },
  cleaner: asBlockbookResponse(asUnknown)
})

/**
 * Send Transaction
 */
export const broadcastTxMessage = (
  signedTx: string
): BlockbookTask<BroadcastTxResponse> => {
  return {
    method: 'sendTransaction',
    params: { hex: signedTx },
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
  pageSize?: number
}
export const addressMessage = (
  address: string,
  asAddress: Cleaner<string> = asString,
  params: AddresssMessageParams = {}
): BlockbookTask<AddressResponse> => {
  const wasAddress = uncleaner(asAddress)
  return {
    method: 'getAccountInfo',
    params: {
      ...{ details: 'basic', page: 1, pageSize: 100, ...params },
      descriptor: wasAddress(address)
    },
    cleaner: asBlockbookResponse(asAddressResponse(asAddress))
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
export const asAddressResponse = (
  asAddress: Cleaner<string> = asString
): Cleaner<AddressResponse> =>
  asObject<AddressResponse>({
    // details: basic
    address: asAddress,
    balance: asString,
    totalReceived: asString,
    totalSent: asString,
    txs: asNumber,
    unconfirmedBalance: asString,
    unconfirmedTxs: asNumber,
    // details: txids
    txids: asOptional(asArray(asString), []),
    // details: txs
    transactions: asOptional(asArray(asBlockbookTransaction(asAddress)), []),
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
  addresses: string[],
  asAddress: Cleaner<string> = asString
): BlockbookTask<SubscribeAddressResponse> => {
  const wasAddress = uncleaner(asAddress)
  return {
    method: 'subscribeAddresses',
    params: {
      addresses: addresses.map(wasAddress)
    },
    cleaner: asBlockbookResponse(asSubscribeAddressResponse(asAddress))
  }
}
export interface SubscribeAddressResponse {
  address: string
  tx: BlockbookTransaction
}
export const asSubscribeAddressResponse = (
  asAddress: Cleaner<string> = asString
): Cleaner<SubscribeAddressResponse> =>
  asObject({
    address: asAddress,
    tx: asBlockbookTransaction(asAddress)
  })
