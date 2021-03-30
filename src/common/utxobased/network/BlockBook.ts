import { EdgeTransaction } from 'edge-core-js'

import { EngineEmitter, EngineEvent } from '../../plugin/makeEngineEmitter'
import { makeSocket } from './Socket'

export interface INewTransactionResponse {
  address: string
  tx: ITransaction
}

interface IWsPendingMessages {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [id: string]: (value: any) => void
}

interface IWsMessage {
  id: string
  method: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any
}

interface IWsResponse {
  id: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
}

export interface IAccountDetailsBasic {
  address: string
  balance: string
  totalReceived: string
  totalSent: string
  txs: number
  unconfirmedBalance: string
  unconfirmedTxs: number
}

interface ITransactionPaginationResponse {
  page: number
  totalPages: number
  itemsOnPage: number
}

interface ITransactionIdPaginationResponse
  extends ITransactionPaginationResponse {
  txids: string[]
}

interface ITransactionDetailsPaginationResponse
  extends ITransactionPaginationResponse {
  transactions?: ITransaction[]
}

interface IAccountOpts {
  details?: string
  from?: number
  to?: number
  page?: number
  perPage?: number
}

export interface ITransaction {
  txid: string
  hex: string
  blockHeight: number
  confirmations: number
  blockTime: number
  fees: string
  vin: Array<{
    txid: string
    vout: number
    value: string
    addresses: string[]
    hex?: string
  }>
  vout: Array<{
    n: number
    value: string
    addresses: string[]
    hex?: string
  }>
}

interface IUTXO {
  txid: string
  vout: number
  value: string
  height?: number
  confirmations?: number
  lockTime?: number
}

export interface IAccountUTXO extends IUTXO {
  address?: string
  path?: string
}

interface IServerInfo {
  name: string
  shortcut: string
  decimals: number
  version: string
  bestHeight: number
  bestHash: string
  block0Hash: string
  testnet: boolean
}

type Callback = () => void | Promise<void>

export interface BlockBook {
  isConnected: boolean

  connect: () => Promise<void>

  disconnect: () => Promise<void>

  fetchInfo: () => Promise<IServerInfo>

  fetchAddress: ((
    address: string,
    opts?: IAccountOpts & {
      details?: 'basic'
    }
  ) => Promise<IAccountDetailsBasic>) &
    ((
      address: string,
      opts: IAccountOpts & {
        details: 'txids'
      }
    ) => Promise<IAccountDetailsBasic & ITransactionIdPaginationResponse>) &
    ((
      address: string,
      opts: IAccountOpts & {
        details: 'txs'
      }
    ) => Promise<
      IAccountDetailsBasic & ITransactionDetailsPaginationResponse
    >) &
    ((address: string, opts?: IAccountOpts) => Promise<IAccountDetailsBasic>)

  watchAddresses: (
    addresses: string[],
    cb?: (response: INewTransactionResponse) => Promise<void>
  ) => void

  watchBlocks: (cb: () => void | Promise<void>) => void

  fetchAddressUtxos: (account: string) => Promise<IAccountUTXO[]>

  fetchTransaction: (hash: string) => Promise<ITransaction>

  broadcastTx: (transaction: EdgeTransaction) => Promise<void>
}

interface BlockBookConfig {
  emitter: EngineEmitter
  wsAddress?: string
}

const baseUri = 'btc1.trezor.io'
const PING_TIMEOUT = 30000

export function makeBlockBook(config: BlockBookConfig): BlockBook {
  const emitter = config.emitter
  const baseWSAddress = config.wsAddress ?? `wss://${baseUri}/websocket`

  const instance: BlockBook = {
    isConnected: false,
    connect,
    disconnect,
    fetchInfo,
    fetchAddress,
    watchAddresses,
    watchBlocks,
    fetchAddressUtxos,
    fetchTransaction,
    broadcastTx
  }
  let wsIdCounter = 0
  const wsPendingMessages: IWsPendingMessages = {}
  let pingTimeout!: NodeJS.Timeout
  let addressesToWatch: string[] = []
  let addressWatcherCallback:
    | undefined
    | ((response: INewTransactionResponse) => void)
  let blockWatcherCallback: Callback = () => {
    return
  }
  const PING_ID = 'ping'
  const WATCH_NEW_BLOCK_EVENT_ID = 'WATCH_NEW_BLOCK_EVENT_ID'
  const WATCH_ADDRESS_TX_EVENT_ID = 'WATCH_ADDRESS_TX_EVENT_ID'

  const socket = makeSocket(baseWSAddress, {
    callbacks: {
      onMessage(message: string) {
        if (!instance.isConnected) return
        const response: IWsResponse = JSON.parse(message)

        switch (response.id) {
          case PING_ID:
            console.log('ping')
            pingTimeout = setTimeout(ping, PING_TIMEOUT)
            break
          case WATCH_NEW_BLOCK_EVENT_ID:
            // Don't notify on successful subscribe
            if (response.data?.subscribed === true) {
              return
            }
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            blockWatcherCallback()
            emitter.emit(EngineEvent.BLOCK_HEIGHT_CHANGED, response.data.height)
            break
          case WATCH_ADDRESS_TX_EVENT_ID:
            // Don't notify on successful subscribe
            if (response.data?.subscribed === true) {
              return
            }
            break
        }

        const fn = wsPendingMessages[response.id]
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete wsPendingMessages[response.id]
        if ('error' in response.data) {
          throw response.data.error
        } else {
          fn?.(response.data)
        }
      }
    }
  })

  async function connect(): Promise<void> {
    if (instance.isConnected) return

    await socket.connect()

    instance.isConnected = true
    // Ping the server for a pong response and start a timeout
    ping()
    watchAddresses(addressesToWatch, addressWatcherCallback)
    sendWsMessage({
      id: WATCH_NEW_BLOCK_EVENT_ID,
      method: 'subscribeNewBlock'
    })
  }

  async function disconnect(): Promise<void> {
    if (!instance.isConnected) return

    socket.disconnect()
    clearTimeout(pingTimeout)
    instance.isConnected = false
  }

  async function promisifyWsMessage<T>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    return await new Promise<T>(resolve => {
      const id = wsIdCounter++
      sendWsMessage<T>({ id: id.toString(), method, params }, resolve)
    })
  }

  function sendWsMessage<T>(
    message: IWsMessage,
    cb?: (response: T) => void
  ): void {
    if (!instance.isConnected) {
      throw new Error('BlockBook websocket not connected')
    }

    if (cb != null) wsPendingMessages[message.id] = cb
    socket.send(JSON.stringify(message))
  }

  function ping(): void {
    sendWsMessage({
      id: PING_ID,
      method: PING_ID
    })
  }

  async function fetchInfo(): Promise<IServerInfo> {
    return await promisifyWsMessage('getInfo')
  }

  async function fetchAddress(
    address: string,
    opts: IAccountOpts = {}
  ): Promise<never> {
    opts = Object.assign(
      {},
      {
        details: 'basic',
        page: 1,
        perPage: 100
      },
      opts
    )

    return await promisifyWsMessage('getAccountInfo', {
      ...opts,
      descriptor: address
    })
  }

  function watchBlocks(cb: Callback): void {
    blockWatcherCallback = cb
  }

  function watchAddresses(
    addresses: string[],
    cb?: (response: INewTransactionResponse) => void
  ): void {
    addressesToWatch = addresses
    addressWatcherCallback = cb
    sendWsMessage(
      {
        id: WATCH_ADDRESS_TX_EVENT_ID,
        method: 'subscribeAddresses',
        params: { addresses }
      },
      (response: INewTransactionResponse) => {
        // Need to resubscribe to addresses
        watchAddresses(addressesToWatch, cb)
        cb?.(response)
      }
    )
  }

  async function fetchAddressUtxos(account: string): Promise<IAccountUTXO[]> {
    return await promisifyWsMessage('getAccountUtxo', { descriptor: account })
  }

  async function fetchTransaction(hash: string): Promise<ITransaction> {
    return await promisifyWsMessage('getTransaction', { txid: hash })
  }

  async function broadcastTx(transaction: EdgeTransaction): Promise<void> {
    await promisifyWsMessage('sendTransaction', { hex: transaction.signedTx })
  }

  return instance
}
