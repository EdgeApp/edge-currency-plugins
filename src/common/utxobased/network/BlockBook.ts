import { EdgeTransaction } from 'edge-core-js'

import { EmitterEvent } from '../../plugin/types'
import { makeSocket } from './Socket'

export interface INewTransactionResponse {
  address: string
  tx: ITransaction
}

interface IWsPendingMessages {
  [id: string]: Function
}

interface IWsMessage {
  id: string
  method: string
  params?: object
}

interface IWsResponse {
  id: string
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

interface IAccountTokens {
  usedTokens: number
  tokens: Array<{
    type: string
    name: string
    path: string
    transfers: number
    decimals: number
    balance: string
    totalReceived: string
    totalSent: string
  }>
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

interface IAccountUTXO extends IUTXO {
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

export interface BlockBook {
  isConnected: boolean

  connect(): Promise<void>

  disconnect(): Promise<void>

  fetchInfo(): Promise<IServerInfo>

  fetchAddress(
    address: string,
    opts?: IAccountOpts & {
      details?: 'basic'
    }
  ): Promise<IAccountDetailsBasic>

  fetchAddress(
    address: string,
    opts: IAccountOpts & {
      details: 'txids'
    }
  ): Promise<IAccountDetailsBasic & ITransactionIdPaginationResponse>

  fetchAddress(
    address: string,
    opts: IAccountOpts & {
      details: 'txs'
    }
  ): Promise<IAccountDetailsBasic & ITransactionDetailsPaginationResponse>

  fetchAddress(
    address: string,
    opts?: IAccountOpts
  ): Promise<IAccountDetailsBasic>

  watchAddresses(
    addresses: string[],
    cb?: (response: INewTransactionResponse) => void
  ): void

  fetchAddressUtxos(account: string): Promise<IAccountUTXO[]>

  fetchTransaction(hash: string): Promise<ITransaction>

  broadcastTx(transaction: EdgeTransaction): Promise<void>
}

export interface BlockHeightEmitter {
  emit(event: EmitterEvent.BLOCK_HEIGHT_CHANGED, blockHeight: number): this
}

interface BlockBookConfig {
  emitter: BlockHeightEmitter
}

const baseUri = 'btc1.trezor.io'
const PING_TIMEOUT = 30000

export function makeBlockBook(config: BlockBookConfig): BlockBook {
  const { emitter } = config

  const instance: BlockBook = {
    isConnected: false,
    connect,
    disconnect,
    fetchInfo,
    fetchAddress,
    watchAddresses,
    fetchAddressUtxos,
    fetchTransaction,
    broadcastTx,
  }
  let wsIdCounter = 0
  const wsPendingMessages: IWsPendingMessages = {}
  let pingTimeout!: NodeJS.Timeout
  let addressesToWatch: string[] = []
  let addressWatcherCallback:
    | undefined
    | ((response: INewTransactionResponse) => void)
  const PING_ID = 'ping'
  const WATCH_NEW_BLOCK_EVENT_ID = 'WATCH_NEW_BLOCK_EVENT_ID'
  const WATCH_ADDRESS_TX_EVENT_ID = 'WATCH_ADDRESS_TX_EVENT_ID'

  const socket = makeSocket(`wss://${baseUri}/websocket`, {
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
            emitter.emit(EmitterEvent.BLOCK_HEIGHT_CHANGED, response.data)
            break
          case WATCH_ADDRESS_TX_EVENT_ID:
            // Don't notify on successful subscribe
            if (response.data?.subscribed === true) {
              return
            }
            break
        }

        const fn = wsPendingMessages[response.id]
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

    console.log('connected to websocket')

    instance.isConnected = true
    // Ping the server for a pong response and start a timeout
    ping()
    watchAddresses(addressesToWatch, addressWatcherCallback)
    sendWsMessage({
      id: WATCH_NEW_BLOCK_EVENT_ID,
      method: 'subscribeNewBlock',
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
    params?: object
  ): Promise<T> {
    return new Promise((resolve) => {
      const id = wsIdCounter++
      sendWsMessage({ id: id.toString(), method, params }, resolve)
    })
  }

  function sendWsMessage(message: IWsMessage, cb?: Function): void {
    if (!instance.isConnected) {
      throw new Error('BlockBook websocket not connected')
    }

    if (cb) wsPendingMessages[message.id] = cb
    socket.send(JSON.stringify(message))
  }

  function ping() {
    sendWsMessage({
      id: PING_ID,
      method: PING_ID,
    })
  }

  async function fetchInfo(): Promise<IServerInfo> {
    return promisifyWsMessage('getInfo')
  }

  function fetchAddress(address: string, opts: IAccountOpts = {}): Promise<any> {
    opts = Object.assign(
      {},
      {
        details: 'basic',
        page: 1,
        perPage: 100
      },
      opts
    )

    return promisifyWsMessage('getAccountInfo', {
      ...opts,
      descriptor: address
    })
  }

  function watchAddresses(
    addresses: string[],
    cb?: (response: INewTransactionResponse) => void
  ) {
    addressesToWatch = addresses
    addressWatcherCallback = cb
    sendWsMessage(
      {
        id: WATCH_ADDRESS_TX_EVENT_ID,
        method: 'subscribeAddresses',
        params: { addresses }
      },
      async (response: INewTransactionResponse) => {
        // Need to resubscribe to addresses
        await watchAddresses(addressesToWatch, cb)
        cb?.(response)
      }
    )
  }

  async function fetchAddressUtxos(account: string): Promise<IAccountUTXO[]> {
    return promisifyWsMessage('getAccountUtxo', { descriptor: account })
  }

  async function fetchTransaction(hash: string): Promise<ITransaction> {
    return promisifyWsMessage('getTransaction', { txid: hash })
  }

  async function broadcastTx(
    transaction: EdgeTransaction
  ): Promise<void> {
    await promisifyWsMessage('sendTransaction', { hex: transaction.signedTx })
  }

  return instance
}
