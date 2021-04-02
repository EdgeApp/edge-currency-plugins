import { EdgeTransaction, EdgeTxidMap } from 'edge-core-js'
import { EventEmitter } from 'events'

import { IProcessorTransaction } from '../utxobased/db/types'

export declare interface EngineEmitter {
  emit: ((
    event: EngineEvent.TRANSACTIONS_CHANGED,
    transactions: EdgeTransaction[]
  ) => boolean) &
    ((
      event: EngineEvent.PROCESSOR_TRANSACTION_CHANGED,
      transaction: IProcessorTransaction
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
      blockHeight: number
    ) => boolean) &
    ((event: EngineEvent.ADDRESSES_CHECKED, progressRatio: number) => boolean) &
    ((event: EngineEvent.TXIDS_CHANGED, txids: EdgeTxidMap) => boolean) &
    ((event: EngineEvent.CONNECTION_OPEN) => void) &
    ((event: EngineEvent.CONNECTION_CLOSE, error?: Error) => this) &
    ((event: EngineEvent.CONNECTION_TIMER, queryTime: number) => this)

  on: ((
    event: EngineEvent.TRANSACTIONS_CHANGED,
    listener: (transactions: EdgeTransaction[]) => Promise<void> | void
  ) => this) &
    ((
      event: EngineEvent.PROCESSOR_TRANSACTION_CHANGED,
      listener: (transaction: IProcessorTransaction) => Promise<void> | void
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
      listener: (blockHeight: number) => Promise<void> | void
    ) => this) &
    ((
      event: EngineEvent.ADDRESSES_CHECKED,
      listener: (progressRatio: number) => Promise<void> | void
    ) => this) &
    ((
      event: EngineEvent.TXIDS_CHANGED,
      listener: (txids: EdgeTxidMap) => Promise<void> | void
    ) => this) &
    ((event: EngineEvent.CONNECTION_OPEN, listener: () => void) => this) &
    ((
      event: EngineEvent.CONNECTION_CLOSE,
      listener: (error?: Error) => void
    ) => this) &
    ((
      event: EngineEvent.CONNECTION_TIMER,
      listener: (queryTime: number) => void
    ) => this)
}
export class EngineEmitter extends EventEmitter {}

export enum EngineEvent {
  TRANSACTIONS_CHANGED = 'transactions:changed',
  PROCESSOR_TRANSACTION_CHANGED = 'processor:transactions:changed',
  WALLET_BALANCE_CHANGED = 'wallet:balance:changed',
  ADDRESS_BALANCE_CHANGED = 'address:balance:changed',
  BLOCK_HEIGHT_CHANGED = 'block:height:changed',
  ADDRESSES_CHECKED = 'addresses:checked',
  TXIDS_CHANGED = 'txids:changed',
  CONNECTION_OPEN = 'connection:open',
  CONNECTION_CLOSE = 'connection:close',
  CONNECTION_TIMER = 'connection:timer'
}
