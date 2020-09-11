import { EventEmitter } from 'events'
import { EdgeTransaction, EdgeTxidMap } from 'edge-core-js'

export enum Event {
  TRANSACTIONS_CHANGED = 'transactions:changed',
  BLOCK_HEIGHT_CHANGED = 'block:height:changed',
  ADDRESSES_CHECKED = 'addresses:checked',
  TXIDS_CHANGED = 'txids:changed'
}

export class Emitter {
  public readonly Event = Event

  private emitter: EventEmitter = new EventEmitter()

  public on(event: Event.TRANSACTIONS_CHANGED, listener: (transactions: EdgeTransaction[]) => void): this
  public on(event: Event.BLOCK_HEIGHT_CHANGED, listener: (blockHeight: number) => void): this
  public on(event: Event.ADDRESSES_CHECKED, listener: (progressRatio: number) => void): this
  public on(event: Event.TXIDS_CHANGED, listener: (txids: EdgeTxidMap) => void): this
  public on(event: Event, listener: (...args: any[]) => void): this {
    this.emitter.on(event, listener)
    return this
  }

  public once(event: Event.TRANSACTIONS_CHANGED, listener: (transactions: EdgeTransaction[]) => void): this
  public once(event: Event.BLOCK_HEIGHT_CHANGED, listener: (blockHeight: number) => void): this
  public once(event: Event.ADDRESSES_CHECKED, listener: (progressRatio: number) => void): this
  public once(event: Event.TXIDS_CHANGED, listener: (txids: EdgeTxidMap) => void): this
  public once(event: Event, listener: (...args: any[]) => void): this {
    this.emitter.once(event, listener)
    return this
  }

  protected emit(event: Event.TRANSACTIONS_CHANGED, transactions: EdgeTransaction[]): this
  protected emit(event: Event.BLOCK_HEIGHT_CHANGED, blockHeight: number): this
  protected emit(event: Event.ADDRESSES_CHECKED, progressRatio: number): this
  protected emit(event: Event.TXIDS_CHANGED, txids: EdgeTxidMap): this
  protected emit(event: Event, ...args: any[]): this {
    this.emitter.emit(event, ...args)
    return this
  }
}