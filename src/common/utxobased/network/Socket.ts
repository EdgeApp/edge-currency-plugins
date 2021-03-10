import { Emitter, EmitterEvent } from '../../plugin/types'
import { setupWS } from './nodejsWS'
import { pushUpdate, removeIdFromQueue } from './socketQueue'
import { InnerSocket, InnerSocketCallbacks, ReadyState } from './types'
import { setupBrowser } from './windowWS'

const TIMER_SLACK = 500
const KEEP_ALIVE_MS = 60000

export type OnFailHandler = (error: Error) => void

export interface potentialWsTask {
  task?: WsTask
}

export interface WsTask {
  method: string
  params: object | undefined
  resolve: (value: any) => void
  reject: (reason?: any) => void
}

export interface WsSubscription {
  method: string
  params: object | undefined
  cb: (value: any) => void
}

export interface Socket {
  readyState: ReadyState
  connect: () => Promise<void>
  disconnect: () => void
  submitTask: (task: WsTask) => void
  subscribe: (subscription: WsSubscription) => void
  isConnected: () => boolean
}

interface SocketConfig {
  queueSize?: number
  timeout?: number
  walletId?: string
  emitter: Emitter
  onQueueSpace: () => potentialWsTask
  healthCheck: () => Promise<object> // function for heartbeat, should submit task itself
}

interface WsMessage {
  task: WsTask
  startTime: number
}

export function makeSocket(uri: string, config: SocketConfig): Socket {
  let socket: InnerSocket | null
  const { emitter, onQueueSpace, queueSize = 5, walletId = '' } = config
  const version = ''
  const subscriptions: Map<string, WsSubscription> = new Map()
  let pendingMessages: Map<string, WsMessage> = new Map()
  let nextId = 0
  let lastKeepAlive = 0
  let connected = false
  let cancelConnect = false
  const timeout: number = 1000 * (config.timeout ?? 30)
  let error: Error | undefined
  let timer: NodeJS.Timeout

  const handleError = (e: Error): void => {
    if (error == null) error = e
    if (connected && socket != null && socket.readyState === ReadyState.OPEN)
      disconnect()
    else cancelConnect = true
    console.log('handled error!', e)
  }

  const logError = (e: Error): void => {
    // TODO: change this to edge log
    console.error(`${e.message}`)
  }

  const disconnect = (): void => {
    clearTimeout(timer)
    connected = false
    if (socket != null) socket.disconnect()
    removeIdFromQueue(uri)
  }

  const onSocketClose = (): void => {
    const err = error ?? new Error('Socket close')
    clearTimeout(timer)
    connected = false
    socket = null
    cancelConnect = false
    pendingMessages.forEach((message, _id) => {
      try {
        message.task.reject(err)
      } catch (e) {
        logError(e)
      }
    })
    pendingMessages = new Map()
    try {
      emitter.emit(EmitterEvent.CONNECTION_CLOSE, err)
    } catch (e) {
      logError(e)
    }
  }

  const onSocketConnect = (): void => {
    if (cancelConnect) {
      if (socket != null) socket.disconnect()
      return
    }
    connected = true
    lastKeepAlive = Date.now()
    try {
      emitter.emit(EmitterEvent.CONNECTION_OPEN)
    } catch (e) {
      handleError(e)
    }
    pendingMessages.forEach((message, id) => {
      transmitMessage(id, message)
    })

    wakeUp()
    cancelConnect = false
  }

  const wakeUp = (): void => {
    pushUpdate({
      id: walletId + '==' + uri,
      updateFunc: () => {
        doWakeUp()
      }
    })
  }

  const doWakeUp = (): void => {
    if (connected && version != null) {
      while (pendingMessages.size < queueSize) {
        const task = onQueueSpace()
        if (task.task == null) break
        submitTask(task.task)
      }
    }
  }

  const subscribe = (subscription: WsSubscription): void => {
    if (socket != null && socket.readyState === ReadyState.OPEN && connected) {
      const id = subscription.method
      const message = {
        id,
        method: subscription.method,
        params: subscription.params ?? {}
      }
      subscriptions.set(id, subscription)
      socket.send(JSON.stringify(message))
    }
  }

  const submitTask = (task: WsTask): void => {
    const id = (nextId++).toString()
    const message = { task, startTime: Date.now() }
    pendingMessages.set(id.toString(), message)
    transmitMessage(id, message)
  }

  const transmitMessage = (id: string, pending: WsMessage): void => {
    const now = Date.now()
    if (
      socket != null &&
      socket.readyState === ReadyState.OPEN &&
      connected &&
      !cancelConnect
    ) {
      pending.startTime = now
      const message = {
        id,
        method: pending.task.method,
        params: pending.task.params ?? {}
      }
      socket.send(JSON.stringify(message))
    }
  }

  const onTimer = (): void => {
    const now = Date.now() - TIMER_SLACK
    if (lastKeepAlive + KEEP_ALIVE_MS < now) {
      lastKeepAlive = now
      // eslint-disable-next-line no-void
      void config
        .healthCheck()
        .catch((e: Error) => handleError(e))
        .then(() => {
          emitter.emit(EmitterEvent.CONNECTION_TIMER, now)
        })
    }

    pendingMessages.forEach((message, id) => {
      if (message.startTime + timeout < now) {
        try {
          message.task.reject(new Error('Timeout'))
        } catch (e) {
          logError(e)
        }
        pendingMessages.delete(id)
      }
    })
    setupTimer()
  }

  const setupTimer = (): void => {
    let nextWakeUp = lastKeepAlive + KEEP_ALIVE_MS
    pendingMessages.forEach((message, _id) => {
      const to = message.startTime + timeout
      if (to < nextWakeUp) nextWakeUp = to
    })

    const now = Date.now() - TIMER_SLACK
    const delay = nextWakeUp < now ? 0 : nextWakeUp - now
    timer = setTimeout(() => onTimer(), delay)
  }

  const onMessage = (messageJson: string): void => {
    try {
      const json = JSON.parse(messageJson)
      if (json.id != null) {
        const id: string = json.id.toString()
        for (const cId of subscriptions.keys()) {
          if (id === cId) {
            const subscription = subscriptions.get(id)
            if (subscription == null) {
              throw new Error(`cannot find subscription for ${id}`)
            }
            if (json.data?.subscribed != null) {
              // dropping subscription accepted message
              return
            }
            subscription.cb(json.data)
            return
          }
        }
        const message = pendingMessages.get(id)
        if (message == null) {
          throw new Error(`Bad response id in ${messageJson}`)
        }
        pendingMessages.delete(id)
        const { error } = json
        try {
          if (error != null) {
            const errorMessage =
              error.message != null
                ? error.message.split('\n')[0]
                : error.connected
            throw new Error(errorMessage)
          }
          message.task.resolve(json.data)
        } catch (e) {
          message.task.reject(e)
        }
      }
    } catch (e) {
      handleError(e)
    }
    wakeUp()
  }

  setupTimer()

  // return a Socket
  return {
    get readyState(): ReadyState {
      return socket?.readyState ?? ReadyState.CLOSED
    },

    async connect() {
      socket?.disconnect()

      return await new Promise<void>(resolve => {
        const cbs: InnerSocketCallbacks = {
          onOpen: () => {
            onSocketConnect()
            resolve()
          },
          onMessage: onMessage,
          onError: event => {
            error = new Error(JSON.stringify(event))
          },
          onClose: onSocketClose
        }

        try {
          socket = setupBrowser(uri, cbs)
        } catch {
          socket = setupWS(uri, cbs)
        }
      })
    },

    disconnect() {
      socket?.disconnect()
      socket = null
      disconnect()
    },

    isConnected(): boolean {
      return socket?.readyState === ReadyState.OPEN
    },

    submitTask(task: WsTask): void {
      submitTask(task)
    },

    subscribe(subscription: WsSubscription): void {
      subscribe(subscription)
    }
  }
}
