import WS from 'ws'

export enum ReadyState {
  CONNECTING,
  OPEN,
  CLOSING,
  CLOSED
}

export interface Socket extends InnerSocket {
  connect(): void
}

interface InnerSocket {
  readyState: ReadyState
  disconnect(): void
  send(data: string): void
}

interface SocketConfig {
  callbacks?: SocketCallbacks
}

export interface SocketCallbacks {
  onError?(error?: Error): void
  onMessage?(message: string): void
}

export interface InnerSocketCallbacks extends SocketCallbacks {
  onOpen(): void
}

export function makeSocket(uri: string, config?: SocketConfig): Socket {
  let socket: InnerSocket | null

  // return socket
  return {
    get readyState(): ReadyState {
      return socket?.readyState ?? ReadyState.CLOSED
    },

    connect() {
      socket?.disconnect()

      return new Promise<void>((resolve) => {
        const callbacks: InnerSocketCallbacks = {
          ...config?.callbacks,
          onOpen() {
            resolve()
          }
        }

        try {
          socket = setupBrowser(uri, callbacks)
        } catch {
          socket = setupWS(uri, callbacks)
        }
      })
    },

    disconnect() {
      socket?.disconnect()
      socket = null
    },

    send(data: string): void {
      socket?.send?.(data)
    }
  }
}

function setupBrowser(uri: string, callbacks?: InnerSocketCallbacks): InnerSocket {
  if (!window?.WebSocket) throw Error('Native browser WebSocket does not exists')

  const socket = new window.WebSocket(uri)
  socket.onopen = () => {
    callbacks?.onOpen?.()
  }
  socket.onmessage = (message: MessageEvent) => {
    callbacks?.onMessage?.(message.data.toString())
  }
  socket.onerror = () => {
    callbacks?.onError?.()
  }

  return {
    get readyState(): ReadyState {
      switch (socket?.readyState) {
        case WebSocket.CONNECTING:
          return ReadyState.CONNECTING
        case WebSocket.OPEN:
          return ReadyState.OPEN
        case WebSocket.CLOSING:
          return ReadyState.CLOSING
        case WebSocket.CLOSED:
        default:
          return ReadyState.CLOSED
      }
    },

    disconnect() {
      if (!socket || socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED)
        return

      socket.close()
    },

    send(data: string) {
      socket?.send(data)
    }
  }
}

function setupWS(uri: string, callbacks?: InnerSocketCallbacks): InnerSocket {
  const ws = new WS(uri)

  ws.on('open', () => {
    callbacks?.onOpen?.()
  })

  ws.on('message', (data: WS.Data) => {
    callbacks?.onMessage?.(data.toString())
  })

  ws.on('error', (error) => {
    callbacks?.onError?.(error)
  })

  return {
    get readyState(): ReadyState {
      switch (ws.readyState) {
        case WS.CONNECTING:
          return ReadyState.CONNECTING
        case WS.OPEN:
          return ReadyState.OPEN
        case WS.CLOSING:
          return ReadyState.CLOSING
        case WS.CLOSED:
        default:
          return ReadyState.CLOSED
      }
    },

    disconnect(): void {
      if (!ws || ws.readyState === WS.CLOSING || ws.readyState === WS.CLOSED)
        return

      ws.removeAllListeners()
      ws.terminate()
    },

    send(data: string): void {
      ws.send(data)
    }
  }
}
