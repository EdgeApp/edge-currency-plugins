import {
  EdgeCurrencyEngineCallbacks,
  EdgeTransaction,
  EdgeTransactionEvent,
  EdgeTxidMap
} from 'edge-core-js/types'
import { EventEmitter } from 'events'

import { SubscribeAddressResponse } from '../utxobased/network/blockbookApi'

export declare interface EngineEmitter {
  emit: ((
    event: EngineEvent.SEEN_TX_CHECKPOINT,
    checkpoint: string
  ) => boolean) &
    ((
      event: EngineEvent.TRANSACTIONS,
      transactionEvents: EdgeTransactionEvent[]
    ) => boolean) &
    ((
      event: EngineEvent.TRANSACTIONS_CHANGED,
      transactions: EdgeTransaction[]
    ) => boolean) &
    ((
      event: EngineEvent.ADDRESS_BALANCE_CHANGED,
      currencyCode: string,
      addressBalanceChanges: Array<{ scriptPubkey: string; balance: string }>
    ) => boolean) &
    ((
      event: EngineEvent.WALLET_BALANCE_CHANGED,
      currencyCode: string,
      nativeBalance: string
    ) => boolean) &
    ((
      event: EngineEvent.BLOCK_HEIGHT_CHANGED,
      uri: string,
      blockHeight: number
    ) => boolean) &
    ((
      event: EngineEvent.NEW_ADDRESS_TRANSACTION,
      uri: string,
      newTx: SubscribeAddressResponse
    ) => boolean) &
    ((event: EngineEvent.ADDRESSES_CHECKED, progressRatio: number) => boolean) &
    ((event: EngineEvent.TXIDS_CHANGED, txids: EdgeTxidMap) => boolean)

  on: ((
    event: EngineEvent.SEEN_TX_CHECKPOINT,
    listener: (checkpoint: string) => Promise<void> | void
  ) => this) &
    ((
      event: EngineEvent.TRANSACTIONS,
      listener: (
        transactionEvents: EdgeTransactionEvent[]
      ) => Promise<void> | void
    ) => boolean) &
    ((
      event: EngineEvent.TRANSACTIONS_CHANGED,
      listener: (transactions: EdgeTransaction[]) => Promise<void> | void
    ) => this) &
    ((
      event: EngineEvent.ADDRESS_BALANCE_CHANGED,
      listener: (
        currencyCode: string,
        addressBalanceChanges: Array<{ scriptPubkey: string; balance: string }>
      ) => Promise<void> | void
    ) => this) &
    ((
      event: EngineEvent.WALLET_BALANCE_CHANGED,
      listener: (
        currencyCode: string,
        nativeBalance: string
      ) => Promise<void> | void
    ) => this) &
    ((
      event: EngineEvent.BLOCK_HEIGHT_CHANGED,
      listener: (uri: string, blockHeight: number) => Promise<void> | void
    ) => this) &
    ((
      event: EngineEvent.NEW_ADDRESS_TRANSACTION,
      listener: (
        uri: string,
        newTx: SubscribeAddressResponse
      ) => Promise<void> | void
    ) => this) &
    ((
      event: EngineEvent.ADDRESSES_CHECKED,
      listener: (progressRatio: number) => Promise<void> | void
    ) => this) &
    ((
      event: EngineEvent.TXIDS_CHANGED,
      listener: (txids: EdgeTxidMap) => Promise<void> | void
    ) => this)
}
export class EngineEmitter extends EventEmitter {}

export enum EngineEvent {
  SEEN_TX_CHECKPOINT = 'seen:tx:checkpoint',
  TRANSACTIONS = 'transactions',
  /** @deprecated Use TRANSACTIONS */
  TRANSACTIONS_CHANGED = 'transactions:changed',
  WALLET_BALANCE_CHANGED = 'wallet:balance:changed',
  ADDRESS_BALANCE_CHANGED = 'address:balance:changed',
  BLOCK_HEIGHT_CHANGED = 'block:height:changed',
  NEW_ADDRESS_TRANSACTION = 'address:transaction:changed',
  ADDRESSES_CHECKED = 'addresses:checked',
  TXIDS_CHANGED = 'txids:changed',
  CONNECTION_OPEN = 'connection:open',
  CONNECTION_CLOSE = 'connection:close',
  CONNECTION_TIMER = 'connection:timer'
}

export const makeEngineEmitter = (
  callbacks: EdgeCurrencyEngineCallbacks
): EngineEmitter => {
  const emitter = new EngineEmitter()

  emitter.on(EngineEvent.ADDRESSES_CHECKED, callbacks.onAddressesChecked)
  emitter.on(
    EngineEvent.BLOCK_HEIGHT_CHANGED,
    (_uri: string, height: number) => {
      callbacks.onBlockHeightChanged(height)
    }
  )
  emitter.on(EngineEvent.SEEN_TX_CHECKPOINT, callbacks.onSeenTxCheckpoint)
  emitter.on(EngineEvent.TRANSACTIONS, callbacks.onTransactions)
  emitter.on(EngineEvent.TRANSACTIONS_CHANGED, callbacks.onTransactionsChanged)
  emitter.on(EngineEvent.TXIDS_CHANGED, callbacks.onTxidsChanged)
  emitter.on(EngineEvent.WALLET_BALANCE_CHANGED, callbacks.onBalanceChanged)

  return emitter
}
