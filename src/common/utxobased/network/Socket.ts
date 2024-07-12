import {
  asBoolean,
  asEither,
  asJSON,
  asMaybe,
  asObject,
  asOptional,
  asString,
  asUnknown,
  Cleaner
} from 'cleaners'
import { EdgeLog } from 'edge-core-js/types'

import { removeItem } from '../../plugin/utils'
import Deferred from './Deferred'
import { setupWS } from './nodejsWS'
import { SocketEmitter, SocketEvent } from './SocketEmitter'
import { pushUpdate, removeIdFromQueue } from './socketQueue'
import { InnerSocket, InnerSocketCallbacks, ReadyState } from './types'
import { setupBrowser } from './windowWS'

const TIMER_SLACK = 500
const KEEP_ALIVE_MS = 50000 // interval at which we keep the connection alive
const WAKE_UP_MS = 5000 // interval at which we wakeUp and potentially onQueueSpace

export type OnFailHandler = (error: Error) => void

export interface WsTask<T> {
  method: string
  params: unknown
  deferred: Deferred<T>
  cleaner?: Cleaner<T>
}

export interface WsSubscription<T> {
  method: string
  params: unknown
  cb: (value: T) => void
  subscribed: boolean
  cleaner: Cleaner<T>
  deferred: Deferred<unknown>
}

export interface Socket {
  readyState: ReadyState
  connect: () => Promise<void>
  disconnect: () => void
  submitTask: <T>(task: WsTask<T>) => void
  onQueueSpace: (cb: OnQueueSpaceCB) => void
  subscribe: <T>(subscription: WsSubscription<T>) => void
  isConnected: () => boolean
}

export type OnQueueSpaceCB = (
  uri: string
) => Promise<WsTask<unknown> | boolean | undefined>

interface SocketConfig {
  asResponse?: Cleaner<WsResponse>
  queueSize?: number
  timeout?: number
  walletId: string
  emitter: SocketEmitter
  log: EdgeLog
  healthCheck: () => Promise<void> // function for heartbeat, should submit task itself
  onQueueSpaceCB: OnQueueSpaceCB
}

interface WsRequest<T> {
  task: WsTask<T>
  startTime: number
}

export type WsResponse = WsResponseMessage[]

export interface WsResponseMessage {
  id: string
  data?: unknown
  error?: { message: string } | { connected: string }
}

interface Subscriptions<T> {
  [key: string]: WsSubscription<T>
}

const asSubscriptionAck = asObject({ subscribed: asBoolean })

interface PendingRequests<T> {
  [key: string]: WsRequest<T>
}

const asResponseMessageDefault = asJSON(
  asObject<WsResponseMessage>({
    id: asString,
    data: asOptional(asUnknown),
    error: asOptional(
      asEither(
        asObject({ message: asString }),
        asObject({ connected: asString })
      )
    )
  })
)
const asResponseDefault = (raw: unknown): WsResponse => [
  asResponseMessageDefault(raw)
]

export function makeSocket(uri: string, config: SocketConfig): Socket {
  let socket: InnerSocket | null
  const {
    asResponse = asResponseDefault,
    emitter,
    log,
    queueSize = 50,
    walletId
  } = config
  log('makeSocket connects to', uri)
  const version = ''
  const socketQueueId = walletId + '==' + uri
  const subscriptions: Subscriptions<any> = {}
  let onQueueSpace = config.onQueueSpaceCB
  let pendingRequests: PendingRequests<any> = {}
  let nextId = 0
  let lastKeepAlive = 0
  let lastWakeUp = 0
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
    log.error('handled error!', e)
  }

  const disconnect = (): void => {
    log.warn('disconnecting from socket', uri)
    clearTimeout(timer)
    connected = false
    if (socket != null) socket.disconnect()
    removeIdFromQueue(socketQueueId)
  }

  const onSocketClose = (): void => {
    const err = error ?? new Error('Socket closed without error')
    log.warn(`onSocketClose with server ${uri}: ${err.message}`)
    clearTimeout(timer)
    connected = false
    socket = null
    cancelConnect = false
    for (const request of Object.values(pendingRequests)) {
      try {
        request.task.deferred.reject(err)
      } catch (e) {
        log.error(e.message)
      }
    }
    pendingRequests = {}
    try {
      emitter.emit(SocketEvent.CONNECTION_CLOSE, uri, err)
    } catch (e) {
      log.error(e.message)
    }
  }

  const onSocketConnect = (): void => {
    log(`onSocketConnect with server ${uri}`)
    if (cancelConnect) {
      if (socket != null) socket.disconnect()
      return
    }
    connected = true
    lastKeepAlive = Date.now()
    try {
      emitter.emit(SocketEvent.CONNECTION_OPEN, uri)
    } catch (e) {
      handleError(e)
    }
    for (const [id, request] of Object.entries(pendingRequests)) {
      transmitRequest(id, request)
    }

    wakeUp()
    cancelConnect = false
  }

  const wakeUp = (): void => {
    log(`wakeUp socket with server ${uri}`)
    pushUpdate({
      id: socketQueueId,
      updateFunc: () => {
        doWakeUp().catch(err => {
          throw new Error(`wake up error from: ${err.message}`)
        })
      }
    })
  }

  const doWakeUp = async (): Promise<void> => {
    log(`doWakeUp socket with server ${uri}`)
    lastWakeUp = Date.now()
    if (connected && version != null) {
      while (Object.keys(pendingRequests).length < queueSize) {
        const task = await onQueueSpace(uri)
        if (task == null) break
        if (typeof task === 'boolean') {
          if (task) continue
          break
        }
        submitTask(task)
      }
    }
  }

  // add any exception, since the passed in template parameter needs to be re-assigned
  const subscribe = <T>(subscription: WsSubscription<T>): void => {
    if (socket != null && socket.readyState === ReadyState.OPEN && connected) {
      const id = subscription.method
      const message = {
        id,
        method: subscription.method,
        params: subscription.params ?? {}
      }
      subscriptions[id] = subscription
      socket.send(JSON.stringify(message))
    }
  }

  // add any exception, since the passed in template parameter needs to be re-assigned
  const submitTask = <T>(task: WsTask<T>): void => {
    const id = (nextId++).toString()
    const request = { task, startTime: Date.now() }
    pendingRequests[id] = request
    transmitRequest(id, request)
  }

  const transmitRequest = <T>(id: string, request: WsRequest<T>): void => {
    const now = Date.now()
    if (
      socket != null &&
      socket.readyState === ReadyState.OPEN &&
      connected &&
      !cancelConnect
    ) {
      request.startTime = now
      const message = {
        id,
        method: request.task.method,
        params: request.task.params ?? {}
      }
      socket.send(JSON.stringify(message) + '\n')
    }
  }

  const onTimer = (): void => {
    log(`socket timer with server ${uri} expired, check if healthCheck needed`)
    const now = Date.now() - TIMER_SLACK
    if (lastKeepAlive + KEEP_ALIVE_MS < now) {
      log(`submitting healthCheck to server ${uri}`)
      lastKeepAlive = now
      config
        .healthCheck()
        .then(() => {
          emitter.emit(SocketEvent.CONNECTION_TIMER, uri, now)
        })
        .catch((e: Error) => handleError(e))
    }

    for (const [id, request] of Object.entries(pendingRequests)) {
      if (request.startTime + timeout < now) {
        try {
          request.task.deferred.reject(new Error(`Timeout for request ${id}`))
        } catch (e) {
          log.error(e.message)
        }
        removeItem(pendingRequests, id)
      }
    }
    wakeUp()
    setupTimer()
  }

  const setupTimer = (): void => {
    log(`setupTimer with server ${uri}`)
    let nextWakeUp = lastWakeUp + WAKE_UP_MS
    for (const request of Object.values(pendingRequests)) {
      const to = request.startTime + timeout
      if (to < nextWakeUp) nextWakeUp = to
    }

    const now = Date.now() - TIMER_SLACK
    const delay = nextWakeUp < now ? 0 : nextWakeUp - now
    timer = setTimeout(() => onTimer(), delay)
  }

  const onMessage = (message: string): void => {
    try {
      const response = asResponse(message)
      for (const responseMessage of response) {
        if (responseMessage.id != null) {
          const id: string = responseMessage.id.toString()

          // Handle subscription message
          const subscription = subscriptions[id]
          if (subscription != null) {
            const cleanData = asMaybe(asSubscriptionAck)(responseMessage.data)
            if (cleanData?.subscribed != null) {
              subscription.subscribed = true
              subscription.deferred.resolve(responseMessage.data)
              continue
            }
            if (!subscription.subscribed) {
              subscription.deferred.reject()
            }
            try {
              subscription.cb(subscription.cleaner(responseMessage.data))
            } catch (error) {
              console.log({
                uri,
                error,
                response: responseMessage,
                subscription
              })
              throw error
            }
            continue
          }

          // Handle response message
          const request = pendingRequests[id]
          if (request != null) {
            removeItem(pendingRequests, id)
            const { error } = responseMessage
            try {
              if (error != null) {
                const errorMessage =
                  'message' in error ? error.message : error.connected
                throw new Error(errorMessage)
              }
              if (request.task.cleaner != null) {
                request.task.deferred.resolve(
                  request.task.cleaner(responseMessage.data)
                )
              } else {
                request.task.deferred.resolve(responseMessage.data)
              }
            } catch (error) {
              console.log({ uri, error, response: responseMessage, request })
              request.task.deferred.reject(error)
            }
            continue
          }

          throw new Error(
            `Unknown message id from incoming ws message: ${message}`
          )
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

        // Append "/websocket" if needed:
        let fullUri = uri
        if (uri.startsWith('wss:') || uri.startsWith('ws:')) {
          fullUri = uri.replace(/\/websocket\/?$/, '') + '/websocket'
        }
        if (uri.startsWith('electrumwss:')) {
          fullUri = uri.replace(/^electrumwss:/, 'wss:')
        }
        if (uri.startsWith('electrumws:')) {
          fullUri = uri.replace(/^electrumws:/, 'ws:')
        }

        try {
          socket = setupBrowser(fullUri, cbs)
        } catch {
          socket = setupWS(fullUri, cbs)
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

    submitTask,

    onQueueSpace(cb: OnQueueSpaceCB): void {
      onQueueSpace = cb
    },

    subscribe
  }
}
