import { InnerSocket, InnerSocketCallbacks, ReadyState } from './types'

export function setupBrowser(
  uri: string,
  callbacks: InnerSocketCallbacks
): InnerSocket {
  if (window.WebSocket == null)
    throw Error('Native browser WebSocket does not exists')

  const socket = new window.WebSocket(uri)
  socket.onopen = () => {
    callbacks.onOpen()
  }
  socket.onmessage = (message: MessageEvent) => {
    callbacks.onMessage(message.data.toString())
  }
  socket.onerror = event => {
    callbacks.onError(event)
  }
  socket.onclose = event => {
    callbacks.onClose(event.code, event.reason)
  }

  return {
    get readyState(): ReadyState {
      switch (socket.readyState) {
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
      if (
        socket == null ||
        socket.readyState === WebSocket.CLOSING ||
        socket.readyState === WebSocket.CLOSED
      )
        return

      socket.close()
    },

    send(data: string) {
      socket.send(data)
    }
  }
}
