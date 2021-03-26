import { EdgeConsole } from 'edge-core-js'

import { EngineEmitter, EngineEvent } from '../../plugin/makeEngineEmitter'
import Deferred from './Deferred'
import { setupWS } from './nodejsWS'
import { pushUpdate, removeIdFromQueue } from './socketQueue'
import { InnerSocket, InnerSocketCallbacks, ReadyState } from './types'
import { setupBrowser } from './windowWS'

const TIMER_SLACK = 500
const KEEP_ALIVE_MS = 60000

export type OnFailHandler = (error: Error) => void

export interface WsTask<T> {
  method: string
  params: unknown
  deferred: Deferred<T>
}

export interface WsSubscription {
  method: string
  params: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cb: (value: any) => void
  subscribed: boolean
  deferred: Deferred<unknown>
}

export interface Socket {
  readyState: ReadyState
  connect: () => Promise<void>
  disconnect: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  submitTask: (task: WsTask<any>) => void
  onQueueSpace: (cb: OnQueueSpaceCB) => void
  subscribe: (subscription: WsSubscription) => void
  isConnected: () => boolean
}

export type OnQueueSpaceCB = () => Promise<WsTask<unknown> | undefined>

interface SocketConfig {
  queueSize?: number
  timeout?: number
  walletId?: string
  emitter: EngineEmitter
  log: EdgeConsole
  healthCheck: () => Promise<unknown> // function for heartbeat, should submit task itself
}

interface WsMessage {
  task: WsTask<unknown>
  startTime: number
}

export function makeSocket(uri: string, config: SocketConfig): Socket {
  let socket: InnerSocket | null
  const { emitter, log, queueSize = 5, walletId = '' } = config
  const version = ''
  const subscriptions: Map<string, WsSubscription> = new Map()
  let onQueueSpace: OnQueueSpaceCB | undefined
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
    log.info('handled error!', e)
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
        message.task.deferred.reject(err)
      } catch (e) {
        log.error(e.message)
      }
    })
    pendingMessages = new Map()
    try {
      emitter.emit(EngineEvent.CONNECTION_CLOSE, err)
    } catch (e) {
      log.error(e.message)
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
      emitter.emit(EngineEvent.CONNECTION_OPEN)
    } catch (e) {
      handleError(e)
    }
    pendingMessages.forEach((message, id) => {
      transmitMessage(id, message)
    })

    wakeUp()
    setupTimer()
    cancelConnect = false
  }

  const wakeUp = (): void => {
    pushUpdate({
      id: walletId + '==' + uri,
      updateFunc: () => {
        doWakeUp().catch(() => {
          throw new Error('wake up')
        })
      }
    })
  }

  const doWakeUp = async (): Promise<void> => {
    if (connected && version != null) {
      while (pendingMessages.size < queueSize) {
        const task = await onQueueSpace?.()
        if (task == null) break
        submitTask(task)
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

  // add any exception, since the passed in template parameter needs to be re-assigned
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submitTask = (task: WsTask<any>): void => {
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
      config
        .healthCheck()
        .then(() => {
          emitter.emit(EngineEvent.CONNECTION_TIMER, now)
        })
        .catch((e: Error) => handleError(e))
    }

    pendingMessages.forEach((message, id) => {
      if (message.startTime + timeout < now) {
        try {
          message.task.deferred.reject(new Error('Timeout'))
        } catch (e) {
          log.error(e.message)
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
              subscription.subscribed = true
              subscription.deferred.resolve(json.data)
              return
            }
            if (!subscription.subscribed) {
              subscription.deferred.reject()
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
              error.message != null ? error.message : error.connected
            throw new Error(errorMessage)
          }
          message.task.deferred.resolve(json.data)
        } catch (e) {
          message.task.deferred.reject(e)
        }
      }
    } catch (e) {
      handleError(e)
    }
    wakeUp()
  }

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

    submitTask(task: WsTask<unknown>): void {
      submitTask(task)
    },

    onQueueSpace(cb: OnQueueSpaceCB): void {
      onQueueSpace = cb
    },

    subscribe(subscription: WsSubscription): void {
      subscribe(subscription)
    }
  }
}
