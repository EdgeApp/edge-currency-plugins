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
import urlParse from 'url-parse'

import { replaceKeyParams } from '../../../util/uriKeyParams'
import { removeItem } from '../../plugin/utils'
import { UtxoInitOptions } from '../engine/types'
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
  cleaner?: Cleaner<T>
}

export type WsTaskGenerator<T> = Generator<WsTask<T>, T, T>

export type WsTaskAsyncGenerator<T> = AsyncGenerator<
  WsTask<T> | boolean,
  boolean,
  T
>

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
  submitTask: <T>(task: WsTask<T>, generator: WsTaskAsyncGenerator<T>) => void
  subscribe: <T>(subscription: WsSubscription<T>) => void
  isConnected: () => boolean
}

export type TaskGeneratorFn = (uri: string) => WsTaskAsyncGenerator<unknown>

interface SocketConfig {
  asResponse?: Cleaner<WsResponse>
  emitter: SocketEmitter
  healthCheck: () => Promise<void> // function for heartbeat, should submit task itself
  initOptions: UtxoInitOptions
  log: EdgeLog
  queueSize?: number
  taskGeneratorFn: TaskGeneratorFn
  timeout?: number
  walletId: string
}

interface WsRequest<T> {
  task: WsTask<T>
  generator: WsTaskAsyncGenerator<T>
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
  let pendingRequests: PendingRequests<any> = {}
  let nextId = 0
  let lastKeepAlive = 0
  let lastWakeUp = 0
  let connected = false
  let cancelConnect = false
  const timeout: number = 1000 * (config.timeout ?? 30)
  let trackedError: unknown
  let timer: NodeJS.Timeout

  const handleError = (e: unknown): void => {
    if (trackedError == null) trackedError = e
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

  const onSocketClose = (code: number): void => {
    const errObj =
      trackedError == null
        ? new Error('Socket closed without error')
        : trackedError instanceof Error
        ? trackedError
        : new Error(String(trackedError))
    log.warn(`onSocketClose with server ${uri}: ${code} ${errObj.message}`)
    clearTimeout(timer)
    connected = false
    socket = null
    cancelConnect = false
    trackedError = undefined
    for (const request of Object.values(pendingRequests)) {
      request.generator.throw(errObj).catch(e => {
        log.error(e.message)
      })
    }
    pendingRequests = {}
    try {
      emitter.emit(SocketEvent.CONNECTION_CLOSE, uri, errObj)
    } catch (e: unknown) {
      log.error(String(e))
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
        const generator = await config.taskGeneratorFn(uri)
        const result = await generator.next()
        const task = result.value
        if (typeof task === 'boolean') {
          if (task) continue
          else break
        }
        instance.submitTask(task, generator)
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
        .catch(e => handleError(e))
    }

    for (const [id, request] of Object.entries(pendingRequests)) {
      if (request.startTime + timeout < now) {
        request.generator
          .throw(new Error(`Timeout for request ${id}`))
          .catch(e => {
            log.error(e.message)
          })
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
              let nextValue
              if (request.task.cleaner != null) {
                nextValue = request.task.cleaner(responseMessage.data)
              } else {
                nextValue = responseMessage.data
              }
              request.generator
                .next(nextValue)
                .then(result => {
                  const task = result.value
                  if (typeof task === 'boolean') {
                    return
                  }
                  instance.submitTask(task, request.generator)
                })
                .catch(e => {
                  log.error(e.message)
                })
            } catch (error) {
              console.log({ uri, error, response: responseMessage, request })
              request.generator.throw(error).catch(e => {
                log.error(e.message)
              })
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
  const instance: Socket = {
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
          onError: err => {
            trackedError = err
          },
          onClose: onSocketClose
        }

        // Append "/websocket" if the uri has no explicit path:
        // We treat URIs with any path or a single trailing slash as having
        // an explicit path.
        let fullUri = uri
        if (uri.startsWith('wss:') || uri.startsWith('ws:')) {
          // There is no path and the uri has no trailing slash
          const pathIsExplicitlyEmpty =
            !uri.endsWith('/') && urlParse(uri).pathname === '/'
          // If path is explicitly empty, then append /websocket
          if (pathIsExplicitlyEmpty) {
            fullUri = uri + '/websocket'
          }
        }

        // Replace any "key params" in the URIs (e.g. `%{nowNodesApiKey}`)
        fullUri = replaceKeyParams(fullUri, config.initOptions)

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

    submitTask: <T>(
      task: WsTask<T>,
      generator: WsTaskAsyncGenerator<T>
    ): void => {
      const id = (nextId++).toString()
      const request: WsRequest<T> = { task, startTime: Date.now(), generator }
      pendingRequests[id] = request
      transmitRequest(id, request)
    },

    subscribe
  }

  return instance
}
