import Websocket from 'ws'
import { EdgeTransaction } from 'edge-core-js'
import Axios, { AxiosInstance } from 'axios'
import { BlockHeightEmitter, EngineEvent } from '../../plugin/types'

const baseUri = 'btc1.trezor.io'

const axios: AxiosInstance = Axios.create({
  baseURL: `https://${baseUri}/api/v2/`
})

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

interface IBlock {
  page: number
  totalPages: number
  itemsOnPage: number
  hash: string
  previousBlockHash: string
  nextBlockHash: string | null
  height: number
  confirmations: number
  size: number
  time: number
  version: number
  merkleRoot: string
  nonce: string
  bits: string
  difficulty: string
  txCount: number
}

export interface BlockBook {
  isConnected: boolean

  connect(): Promise<void>

  disconnect(): Promise<void>

  fetchBlock(height?: number): Promise<IBlock>

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

  fetchAddress(address: string, opts?: IAccountOpts): Promise<IAccountDetailsBasic>

  watchAddresses(addresses: string[], cb?: (response: INewTransactionResponse) => void): void

  fetchAddressUtxos(account: string): Promise<IAccountUTXO[]>

  fetchTransaction(hash: string): Promise<ITransaction>

  broadcastTx(transaction: EdgeTransaction): Promise<EdgeTransaction>
}

interface BlockBookConfig {
  emitter: BlockHeightEmitter
}

export function makeBlockBook(config: BlockBookConfig): BlockBook {
  const instance: BlockBook = {
    isConnected: false,
    connect,
    disconnect,
    fetchBlock,
    fetchAddress,
    watchAddresses,
    fetchAddressUtxos,
    fetchTransaction,
    broadcastTx
  }
  let wsIdCounter = 0
  let wsPendingMessages: IWsPendingMessages = {}
  let pingTimeout!: NodeJS.Timeout
  let addressesToWatch: string[] = []
  let addressWatcherCallback: undefined | ((response: INewTransactionResponse) => void)
  const WATCH_NEW_BLOCK_EVENT_ID = 'WATCH_NEW_BLOCK_EVENT_ID'
  const WATCH_ADDRESS_TX_EVENT_ID = 'WATCH_ADDRESS_TX_EVENT_ID'

  const ws = new Websocket(`wss://${baseUri}/websocket`)

  ws.on('open', () => {
    console.log('connected to websocket')

    instance.isConnected = true

    // Ping the server for a pong response and start a timeout
    ws.ping()
    watchAddresses(addressesToWatch, addressWatcherCallback)
  })

  ws.on('message', (event: Websocket.Data) => {
    const response = JSON.parse(event.toString())
    handleWsResponse(response)
  })

  ws.on('ping', (data) => {
    console.log('ping', data.toString())
  })

  ws.on('pong', (data) => {
    console.log('pong', data.toString())

    pingTimeout = setTimeout(() => ws.ping(), 30000)
  })

  ws.on('error', (error) => {
    console.log('error', error)
  })

  async function connect(): Promise<void> {
    if (instance.isConnected) return

    // Listen once to the open message to ensure we are connected before returning
    await new Promise((resolve) => {
      ws.once('open', () => {
        // Watch for new blocks
        sendWsMessage({
          id: WATCH_NEW_BLOCK_EVENT_ID,
          method: 'subscribeNewBlock'
        })

        resolve()
      })
    })
  }

  async function disconnect(): Promise<void> {
    if (!instance.isConnected) return

    ws.terminate()

    clearTimeout(pingTimeout)
    instance.isConnected = false
  }

  async function promisifyWsMessage<T>(method: string, params: object): Promise<T> {
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
    ws.send(JSON.stringify(message))
  }

  function handleWsResponse(response: IWsResponse): void {
    if (response.id === WATCH_NEW_BLOCK_EVENT_ID) {
      config.emitter.emit(EngineEvent.BLOCK_HEIGHT_CHANGED, response.data)
    } else if (
      response.id === WATCH_ADDRESS_TX_EVENT_ID &&
      response.data?.subscribed === true
    ) {
      // Don't notify on successful subscribe
      return
    }

    wsPendingMessages[response.id]?.(response.data)
    delete wsPendingMessages[response.id]
  }

  async function fetchBlock(hashOrHeight?: string | number): Promise<IBlock> {
    if (!hashOrHeight) {
      const { data: { blockHash } } = await axios.get('/block-index')
      hashOrHeight = blockHash
    }
    const { data: block } = await axios.get<IBlock>(`/block/${hashOrHeight}`)
    return block
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

  async function broadcastTx(transaction: EdgeTransaction): Promise<EdgeTransaction> {
    // TODO:
    return transaction
  }

  return instance
}
