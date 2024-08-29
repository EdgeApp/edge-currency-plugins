export interface InnerSocketCallbacks {
  /**
   * Called when the socket closes.
   * See rfc6455 section 7.4.1 for status codes.
   */
  onClose: (code: number, reason: string) => void

  onError: (error?: Event | Error) => void
  onMessage: (message: string) => void
  onOpen: () => void
}

export enum ReadyState {
  CONNECTING,
  OPEN,
  CLOSING,
  CLOSED
}

export interface InnerSocket {
  readyState: ReadyState
  disconnect: () => void
  send: (message: string) => void
}
