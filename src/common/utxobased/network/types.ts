export interface InnerSocketCallbacks {
  onError: (error?: unknown) => void
  onMessage: (message: string) => void
  onClose: (error?: Error) => void
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
