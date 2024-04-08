import { EventEmitter } from 'events'

export declare interface SocketEmitter {
  emit: ((event: SocketEvent.CONNECTION_OPEN, uri: string) => void) &
    ((
      event: SocketEvent.CONNECTION_CLOSE,
      uri: string,
      error?: Error
    ) => boolean) &
    ((
      event: SocketEvent.CONNECTION_TIMER,
      uri: string,
      queryTime: number
    ) => boolean)

  on: ((
    event: SocketEvent.CONNECTION_OPEN,
    listener: (uri: string) => void
  ) => this) &
    ((
      event: SocketEvent.CONNECTION_CLOSE,
      listener: (uri: string, error?: Error) => void
    ) => this) &
    ((
      event: SocketEvent.CONNECTION_TIMER,
      listener: (uri: string, queryTime: number) => void
    ) => this)
}
export class SocketEmitter extends EventEmitter {}

export enum SocketEvent {
  CONNECTION_OPEN = 'connection:open',
  CONNECTION_CLOSE = 'connection:close',
  CONNECTION_TIMER = 'connection:timer'
}
