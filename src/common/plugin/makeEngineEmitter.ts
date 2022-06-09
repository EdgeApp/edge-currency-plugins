import {
  EdgeCurrencyEngineCallbacks,
  EdgeTransaction,
  EdgeTxidMap
} from 'edge-core-js/types'
import { EventEmitter } from 'events'

import { SubscribeAddressResponse } from '../utxobased/network/BlockBookAPI'

export declare interface EngineEmitter {
  emit: ((
    event: EngineEvent.TRANSACTIONS_CHANGED,
    transactions: EdgeTransaction[]
  ) => boolean) &
    ((
      event: EngineEvent.ADDRESS_BALANCE_CHANGED,
      currencyCode: string,
      nativeDiff: string
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
    event: EngineEvent.TRANSACTIONS_CHANGED,
    listener: (transactions: EdgeTransaction[]) => Promise<void> | void
  ) => this) &
    ((
      event: EngineEvent.ADDRESS_BALANCE_CHANGED,
      listener: (
        currencyCode: string,
        nativeDiff: string
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

  emitter.on(EngineEvent.TRANSACTIONS_CHANGED, callbacks.onTransactionsChanged)
  emitter.on(EngineEvent.WALLET_BALANCE_CHANGED, callbacks.onBalanceChanged)
  emitter.on(EngineEvent.ADDRESSES_CHECKED, callbacks.onAddressesChecked)
  emitter.on(EngineEvent.TXIDS_CHANGED, callbacks.onTxidsChanged)

  return emitter
}
