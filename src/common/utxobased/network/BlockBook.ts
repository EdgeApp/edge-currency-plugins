import Websocket from 'ws'
import { EdgeTransaction } from 'edge-core-js'
import axios, { AxiosInstance } from 'axios'

import { Network } from './Network'

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
  address: string
  path: string
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

interface BlockBookConfig {
  callbacks?: BlockBookCallbacks
}

interface BlockBookCallbacks {
  onNewBlock?: (block: IBlock) => void
}

export class BlockBook extends Network {
  public readonly baseUri = 'btc1.trezor.io'
  public isConnected = false
  public currentBlock!: IBlock

  private axios: AxiosInstance
  private ws!: Websocket
  private waitForWs: Promise<any>
  private wsIdCounter = 0
  private wsPendingMessages: IWsPendingMessages = {}
  private pingTimeout!: NodeJS.Timeout
  private addressesToWatch: string[] = []
  private addressWatcherCallback = (
    response: INewTransactionResponse
  ) => {}
  private readonly WATCH_NEW_BLOCK_EVENT_ID =
    'WATCH_NEW_BLOCK_EVENT_ID'
  private readonly WATCH_ADDRESS_TX_EVENT_ID =
    'WATCH_ADDRESS_TX_EVENT_ID'

  private readonly callbacks: BlockBookCallbacks

  constructor(config?: BlockBookConfig) {
    super()

    this.callbacks = config?.callbacks ?? {}

    this.axios = axios.create({
      baseURL: `https://${this.baseUri}/api/v2/`
    })

    this.waitForWs = new Promise((resolve) => {
      this.setupWebsocket(resolve)
    })
  }

  private setupWebsocket(onReady: Function): void {
    this.ws = new Websocket(`wss://${this.baseUri}/websocket`)

    this.ws.on('open', () => {
      console.log('connected to websocket')

      onReady()

      this.isConnected = true

      // Ping the server for a pong response and start a timeout
      this.ws.ping()
      this.watchAddresses(this.addressesToWatch, this.addressWatcherCallback)
    })

    this.ws.on('message', (event: Websocket.Data) => {
      const response = JSON.parse(event.toString())
      this.handleWsResponse(response)
    })

    this.ws.on('ping', (data) => {
      console.log('ping', data.toString())
    })

    this.ws.on('pong', (data) => {
      console.log('pong', data.toString())

      this.pingTimeout = setTimeout(() => this.ws.ping(), 30000)
    })

    this.ws.on('error', (error) => {
      console.log('error', error)
    })

    this.ws.on('close', (code, reason) => {
      console.log('closed:', code, '-', reason)

      this.isConnected = false
      clearTimeout(this.pingTimeout)

      this.connect()
    })
  }

  public async connect(): Promise<void> {
    if (this.isConnected) return

    // Listen once to the open message to ensure we are connected before returning
    const onWsOpenPromise = new Promise((resolve) => {
      this.ws.once('open', () => {
        resolve()
      })
    })

    // When connecting grab the most recent block so we have it cached
    const fetchBlockPromise = this.fetchBlock()
      .then((block) => {
        this.currentBlock = block
      })

    this.waitForWs = this.waitForWs
      .then(() => Promise.all([ fetchBlockPromise, onWsOpenPromise ]))

    return this.waitForWs
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) return

    this.ws.terminate()
  }

  private async promisifyWsMessage<T>(
    method: string,
    params: object
  ): Promise<T> {
    return new Promise((resolve) => {
      const id = this.wsIdCounter++
      this.sendWsMessage({ id: id.toString(), method, params }, resolve)
    })
  }

  private sendWsMessage(message: IWsMessage, cb?: Function): void {
    this.waitForWs
      .then(() => {
        if (cb) this.wsPendingMessages[message.id] = cb
        this.ws.send(JSON.stringify(message))
      })
  }

  private handleWsResponse(response: IWsResponse): void {
    if (response.id === this.WATCH_NEW_BLOCK_EVENT_ID) {
      this.setCurrentBlock(response.data)
    } else
    // Don't notify on successful subscribe
    if (
      response.id === this.WATCH_ADDRESS_TX_EVENT_ID &&
      response.data?.subscribed === true
    ) {
      return
    }

    this.wsPendingMessages[response.id]?.(response.data)
    delete this.wsPendingMessages[response.id]
  }

  public async fetchBlock(hashOrHeight?: string | number): Promise<IBlock> {
    if (!hashOrHeight) {
      const { data: { blockHash} } = await this.axios.get('/block-index')
      hashOrHeight = blockHash
    }
    const { data: block } = await this.axios.get<IBlock>(`/block/${hashOrHeight}`)
    return block
  }

  public watchForNewBlocks(): void {
    return this.sendWsMessage(
      {
        id: this.WATCH_NEW_BLOCK_EVENT_ID,
        method: 'subscribeNewBlock'
      }
    )
  }

  private setCurrentBlock(block: IBlock) {
    this.currentBlock = block
    this.callbacks.onNewBlock?.(block)
  }

  public fetchAddress(
    address: string,
    opts?: IAccountOpts & {
      details?: 'basic'
    }
  ): Promise<IAccountDetailsBasic>

  public fetchAddress(
    address: string,
    opts: IAccountOpts & {
      details: 'txids'
    }
  ): Promise<IAccountDetailsBasic & ITransactionIdPaginationResponse>

  public fetchAddress(
    address: string,
    opts: IAccountOpts & {
      details: 'txs'
    }
  ): Promise<IAccountDetailsBasic & ITransactionDetailsPaginationResponse>

  public fetchAddress(address: string, opts: IAccountOpts = {}) {
    opts = Object.assign(
      {},
      {
        details: 'basic',
        page: 1,
        perPage: 100
      },
      opts
    )

    return this.promisifyWsMessage('getAccountInfo', {
      ...opts,
      descriptor: address
    })
  }

  public watchAddresses(
    addresses: string[],
    cb: (response: INewTransactionResponse) => void
  ) {
    this.addressesToWatch = addresses
    this.addressWatcherCallback = cb
    this.sendWsMessage(
      {
        id: this.WATCH_ADDRESS_TX_EVENT_ID,
        method: 'subscribeAddresses',
        params: { addresses }
      },
      async (response: INewTransactionResponse) => {
        // Need to resubscribe to addresses
        await this.watchAddresses(this.addressesToWatch, cb)
        cb(response)
      }
    )
  }

  public async fetchAddressUtxos(
    account: string
  ): Promise<IAccountUTXO[]> {
    return this.promisifyWsMessage('getAccountUtxo', { descriptor: account })
  }

  public async fetchTransaction(hash: string): Promise<ITransaction> {
    return this.promisifyWsMessage('getTransaction', { txid: hash })
  }

  public async broadcastTx(transaction: EdgeTransaction): Promise<EdgeTransaction> {
    // TODO:
    return transaction
  }
}
