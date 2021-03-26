import { EdgeConsole, EdgeTransaction } from 'edge-core-js'

import { EngineEmitter, EngineEvent } from '../../plugin/makeEngineEmitter'
import {
  addressMessage,
  addressUtxosMessage,
  broadcastTxMessage,
  infoMessage,
  PartialTask,
  pingMessage,
  subscribeAddressesMessage,
  subscribeNewBlockMessage,
  transactionMessage
} from './BlockBookAPI'
import Deferred from './Deferred'
import { makeSocket, OnQueueSpaceCB } from './Socket'

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

export interface ITransactionIdPaginationResponse
  extends IAccountDetailsBasic,
    ITransactionPaginationResponse {
  txids: string[]
}

export interface ITransactionDetailsPaginationResponse
  extends IAccountDetailsBasic,
    ITransactionPaginationResponse {
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

  onQueueSpace: (cb: OnQueueSpaceCB) => void

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
    ) => Promise<ITransactionIdPaginationResponse>) &
    ((
      address: string,
      opts: IAccountOpts & {
        details: 'txs'
      }
    ) => Promise<ITransactionDetailsPaginationResponse>) &
    ((address: string, opts?: IAccountOpts) => Promise<IAccountDetailsBasic>)

  watchAddresses: (
    addresses: string[],
    cb: (response: INewTransactionResponse) => void | Promise<void>,
    deferred: Deferred<unknown>
  ) => void

  watchBlocks: (
    cb: () => void | Promise<void>,
    deferred: Deferred<unknown>
  ) => void

  fetchAddressUtxos: (account: string) => Promise<IAccountUTXO[]>

  fetchTransaction: (hash: string) => Promise<ITransaction>

  broadcastTx: (transaction: EdgeTransaction) => Promise<void>
}

export interface BlockHeightEmitter {
  emit: (event: EngineEvent.BLOCK_HEIGHT_CHANGED, blockHeight: number) => this
}

interface BlockBookConfig {
  emitter: EngineEmitter
  wsAddress?: string
  log: EdgeConsole
}

const baseUri = 'btc1.trezor.io'

export function makeBlockBook(config: BlockBookConfig): BlockBook {
  const { emitter, log } = config
  const baseWSAddress = config.wsAddress ?? `wss://${baseUri}/websocket`

  const instance: BlockBook = {
    isConnected: false,
    connect,
    disconnect,
    onQueueSpace,
    fetchInfo,
    fetchAddress,
    watchAddresses,
    watchBlocks,
    fetchAddressUtxos,
    fetchTransaction,
    broadcastTx
  }

  emitter.on(EngineEvent.CONNECTION_OPEN, () => {
    return
  })
  emitter.on(EngineEvent.CONNECTION_CLOSE, (error?: Error) => {
    log.warn(error)
  })
  emitter.on(EngineEvent.CONNECTION_TIMER, (_queryTime: number) => {
    return
  })

  const socket = makeSocket(baseWSAddress, {
    healthCheck: ping,
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

  function onQueueSpace(cb: OnQueueSpaceCB): void {
    socket.onQueueSpace(cb)
  }

  async function promisifyWsMessage<T>(message: PartialTask): Promise<T> {
    const deferred = new Deferred<T>()
    socket.submitTask({ ...message, deferred })
    return await deferred.promise
  }

  async function ping(): Promise<never> {
    return await promisifyWsMessage(pingMessage())
  }

  async function fetchInfo(): Promise<IServerInfo> {
    return await promisifyWsMessage(infoMessage())
  }

  async function fetchAddress(
    address: string,
    opts: IAccountOpts = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    return await promisifyWsMessage(addressMessage(address, opts))
  }

  async function watchBlocks(
    cb: Callback,
    deferred: Deferred<unknown>
  ): Promise<void> {
    const socketCb = async (value: INewBlockResponse): Promise<void> => {
      await cb()
      emitter.emit(EngineEvent.BLOCK_HEIGHT_CHANGED, value.height)
    }
    socket.subscribe({
      ...subscribeNewBlockMessage(),
      cb: socketCb,
      deferred,
      subscribed: false
    })
  }

  function watchAddresses(
    addresses: string[],
    cb: (response: INewTransactionResponse) => Promise<void> | void,
    deferred: Deferred<unknown>
  ): void {
    socket.subscribe({
      ...subscribeAddressesMessage(addresses),
      cb,
      deferred,
      subscribed: false
    })
  }

  async function fetchAddressUtxos(account: string): Promise<IAccountUTXO[]> {
    return await promisifyWsMessage(addressUtxosMessage(account))
  }

  async function fetchTransaction(hash: string): Promise<ITransaction> {
    return await promisifyWsMessage(transactionMessage(hash))
  }

  async function broadcastTx(transaction: EdgeTransaction): Promise<void> {
    await promisifyWsMessage(broadcastTxMessage(transaction))
  }

  return instance
}
