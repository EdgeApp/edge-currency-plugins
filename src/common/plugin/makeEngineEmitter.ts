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
      event: EngineEvent.BALANCE_CHANGED,
      currencyCode: string,
      nativeBalance: string
    ) => boolean) &
    ((
      event: EngineEvent.BLOCK_HEIGHT_CHANGED,
      blockHeight: number
    ) => boolean) &
    ((event: EngineEvent.ADDRESSES_CHECKED, progressRatio: number) => boolean) &
    ((event: EngineEvent.TXIDS_CHANGED, txids: EdgeTxidMap) => boolean)

  on: ((
    event: EngineEvent.TRANSACTIONS_CHANGED,
    listener: (transactions: EdgeTransaction[]) => Promise<void> | void
  ) => this) &
    ((
      event: EngineEvent.PROCESSOR_TRANSACTION_CHANGED,
      listener: (transaction: IProcessorTransaction) => Promise<void> | void
    ) => this) &
    ((
      event: EngineEvent.BALANCE_CHANGED,
      listener: (
        currencyCode: string,
        balanceDiff: string
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
    ) => this)
}
export class EngineEmitter extends EventEmitter {}

export enum EngineEvent {
  TRANSACTIONS_CHANGED = 'transactions:changed',
  PROCESSOR_TRANSACTION_CHANGED = 'processor:transactions:changed',
  BALANCE_CHANGED = 'balance:changed',
  BLOCK_HEIGHT_CHANGED = 'block:height:changed',
  ADDRESSES_CHECKED = 'addresses:checked',
  TXIDS_CHANGED = 'txids:changed'
}
