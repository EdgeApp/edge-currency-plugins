import {
  asArray,
  asMaybe,
  asNumber,
  asObject,
  asString,
  asUndefined,
  Cleaner
} from 'cleaners'

/**
 * Websocket Task
 */
export interface ElectrumTask<T> {
  method: string
  params: unknown
  cleaner: Cleaner<T>
}

// ---------------------------------------------------------------------
// Electrum Types
// ---------------------------------------------------------------------

export interface ElectrumUtxo {
  tx_pos: number
  value: number
  tx_hash: string
  height: number
}
export const asElectrumUtxo: Cleaner<ElectrumUtxo> = asObject({
  tx_pos: asNumber,
  value: asNumber,
  tx_hash: asString,
  height: asNumber
})

export interface ElectrumTransaction {
  blockhash: string
  blocktime: number
  confirmations: number
  hash: string
  hex: string
  locktime: number
  size: number
  time: number
  txid: string
  version: number
  vin: Array<{
    scriptSig: {
      asm: string
      hex: string
    }
    sequence: number
    txid: string
    vout: number
  }>
  vout: Array<{
    n: number
    scriptPubKey: {
      addresses: string[]
      asm: string
      hex: string
      reqSigs: number
      type: string
    }
    value: number
  }>
}

export const asElectrumTransaction = (
  asAddress: Cleaner<string> = asString
): Cleaner<ElectrumTransaction> =>
  asObject({
    blockhash: asString,
    blocktime: asNumber,
    confirmations: asNumber,
    hash: asString,
    hex: asString,
    locktime: asNumber,
    size: asNumber,
    time: asNumber,
    txid: asString,
    version: asNumber,
    vin: asArray(
      asObject({
        scriptSig: asObject({
          asm: asString,
          hex: asString
        }),
        sequence: asNumber,
        txid: asString,
        vout: asNumber
      })
    ),
    vout: asArray(
      asObject({
        n: asNumber,
        scriptPubKey: asObject({
          addresses: asArray(asAddress),
          asm: asString,
          hex: asString,
          reqSigs: asNumber,
          type: asString
        }),
        value: asNumber
      })
    )
  })

// ---------------------------------------------------------------------
// Electrum API Response Types
// ---------------------------------------------------------------------

/**
 * Error Response
 */
export type ElectrumErrorResponse = ReturnType<typeof asElectrumErrorResponse>
export const asElectrumErrorResponse = asObject({
  error: asObject({
    message: asString
  })
})

/**
 * Electrum Response Generic
 */
export type ElectrumResponse<T> = T
export const asElectrumResponse = <T>(asT: Cleaner<T>): Cleaner<T> => raw => {
  const errResponse = asMaybe(asElectrumErrorResponse)(raw)

  if (errResponse != null)
    throw new Error(`Electrum Error: ${errResponse.error.message}`)

  return asT(raw)
}

// ---------------------------------------------------------------------
// Electrum API Messages
// ---------------------------------------------------------------------

/**
 * Ping Message
 */
export const pingMessage = (): ElectrumTask<PingResponse> => {
  return {
    method: 'server.ping',
    params: undefined,
    cleaner: asElectrumResponse(asPingResponse)
  }
}
export type PingResponse = ReturnType<typeof asPingResponse>
export const asPingResponse = asMaybe(asUndefined)

/**
 * List Unspent (Get UTXOs)
 */
export const listUnspentMessage = (
  scriptHash: string
): ElectrumTask<ListUnspentResponse> => {
  return {
    method: 'blockchain.scripthash.listunspent',
    params: [scriptHash],
    cleaner: asElectrumResponse(asListUnspentResponse)
  }
}
export type ListUnspentResponse = ElectrumUtxo[]
export const asListUnspentResponse: Cleaner<ListUnspentResponse> = asArray(
  asElectrumUtxo
)

/**
 * Get Address Transactions
 */
export const addressTransactionsMessage = (
  scriptHash: string
): ElectrumTask<AddressTransactionsResponse> => ({
  method: 'blockchain.scripthash.get_history',
  params: [scriptHash],
  cleaner: asElectrumResponse(asAddressTransactionsResponse)
})
export type AddressTransactionsResponse = ReturnType<
  typeof asAddressTransactionsResponse
>
export const asAddressTransactionsResponse = asArray(
  asObject({
    height: asNumber,
    tx_hash: asString
  })
)

/**
 * Get Transaction
 */
export const transactionMessage = (
  txHash: string,
  asAddress: Cleaner<string> = asString
): ElectrumTask<TransactionResponse> => ({
  method: 'blockchain.transaction.get',
  params: [txHash, true],
  cleaner: asElectrumResponse(asTransactionResponse(asAddress))
})
export type TransactionResponse = ElectrumTransaction
export const asTransactionResponse = asElectrumTransaction
