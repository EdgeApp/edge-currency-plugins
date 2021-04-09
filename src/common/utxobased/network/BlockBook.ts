import { EdgeLog, EdgeTransaction } from 'edge-core-js'

import { EngineEmitter, EngineEvent } from '../../plugin/makeEngineEmitter'
import { makeSocket, potentialWsTask, WsTask } from './Socket'

export interface INewTransactionResponse {
  address: string
  tx: ITransaction
}

export interface INewBlockResponse {
  height: number
  hash: string
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
    cb: (response: INewTransactionResponse) => Promise<void>
  ) => void

  watchBlocks: (cb: () => void | Promise<void>) => void

  fetchAddressUtxos: (account: string) => Promise<IAccountUTXO[]>

  fetchTransaction: (hash: string) => Promise<ITransaction>

  broadcastTx: (transaction: EdgeTransaction) => Promise<void>
}

interface BlockBookConfig {
  emitter: EngineEmitter
  wsAddress?: string
  log: EdgeLog
}

const baseUri = 'btc1.trezor.io'

export function makeBlockBook(config: BlockBookConfig): BlockBook {
  const { emitter, log } = config
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

  emitter.on(EngineEvent.CONNECTION_OPEN, () => {})
  emitter.on(EngineEvent.CONNECTION_CLOSE, (error?: Error) => {
    if (error != null) {
      throw new Error(`connection closing due to ${error.message}`)
    }
  })
  emitter.on(EngineEvent.CONNECTION_TIMER, (queryTime: number) => {})
  const onQueueSpace = (): potentialWsTask => {
    return {}
  }

  const socket = makeSocket(baseWSAddress, {
    healthCheck: ping,
    onQueueSpace,
    log,
    emitter
  })

  async function connect(): Promise<void> {
    if (instance.isConnected) return

    await socket.connect()
    instance.isConnected = socket.isConnected()
  }

  async function disconnect(): Promise<void> {
    if (!instance.isConnected) return

    socket.disconnect()
    instance.isConnected = false
  }

  async function promisifyWsMessage<T>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    return await new Promise((resolve, reject) => {
      sendWsMessage({ method, params, resolve, reject })
    })
  }

  function sendWsMessage(task: WsTask): void {
    socket.submitTask(task)
  }

  async function ping(): Promise<object> {
    return await promisifyWsMessage('ping')
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

  async function watchBlocks(cb: Callback): Promise<void> {
    const socketCb = async (value: INewBlockResponse): Promise<void> => {
      // eslint-disable-next-line no-void
      await cb()
      emitter.emit(EngineEvent.BLOCK_HEIGHT_CHANGED, value.height)
    }
    socket.subscribe({
      method: 'subscribeNewBlock',
      params: {},
      cb: socketCb
    })
  }

  function watchAddresses(
    addresses: string[],
    cb: (response: INewTransactionResponse) => Promise<void>
  ): void {
    socket.subscribe({
      method: 'subscribeAddresses',
      params: { addresses },
      cb
    })
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
