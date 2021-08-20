import { EdgeLog, EdgeTransaction } from 'edge-core-js'

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
import { SocketEmitter } from './MakeSocketEmitter'
import { makeSocket, OnQueueSpaceCB } from './Socket'

export interface ITransactionBroadcastResponse {
  result: string // txid
}

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
    n: number
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

interface IServerInfoVersion {
  version: string
  subversion: string
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
  backend?: IServerInfoVersion
}

export type WatchAddressesCB = (
  response: INewTransactionResponse
) => void | Promise<void>
export type WatchBlocksCB = () => void | Promise<void>

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
    deferredAddressSub: Deferred<unknown>
  ) => void

  watchBlocks: (deferredBlockSub: Deferred<unknown>) => void

  fetchAddressUtxos: (account: string) => Promise<IAccountUTXO[]>

  fetchTransaction: (hash: string) => Promise<ITransaction>

  broadcastTx: (
    transaction: EdgeTransaction
  ) => Promise<ITransactionBroadcastResponse>
}

interface BlockBookConfig {
  socketEmitter: SocketEmitter
  engineEmitter: EngineEmitter
  wsAddress: string
  log: EdgeLog
  walletId: string
  onQueueSpaceCB: OnQueueSpaceCB
}

export function makeBlockBook(config: BlockBookConfig): BlockBook {
  const {
    wsAddress,
    socketEmitter,
    engineEmitter,
    log,
    onQueueSpaceCB,
    walletId
  } = config
  log(`makeBlockBook with uri ${wsAddress}`)

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

  const socket = makeSocket(wsAddress, {
    healthCheck: ping,
    onQueueSpaceCB,
    log,
    emitter: socketEmitter,
    walletId
  })

  async function connect(): Promise<void> {
    log(`connecting to blockbook socket with uri ${wsAddress}`)
    if (instance.isConnected) return

    await socket.connect()
    instance.isConnected = socket.isConnected()
  }

  async function disconnect(): Promise<void> {
    log(
      `disconnecting from blockbook socket with uri ${wsAddress}, currently connected: ${instance.isConnected}`
    )
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

  async function fetchAddressUtxos(account: string): Promise<IAccountUTXO[]> {
    return await promisifyWsMessage(addressUtxosMessage(account))
  }

  async function fetchTransaction(hash: string): Promise<ITransaction> {
    return await promisifyWsMessage(transactionMessage(hash))
  }

  async function fetchAddress(
    address: string,
    opts: IAccountOpts = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    return await promisifyWsMessage(addressMessage(address, opts))
  }

  async function watchBlocks(
    deferredBlockSub: Deferred<unknown>
  ): Promise<void> {
    const socketCb = async (value: INewBlockResponse): Promise<void> => {
      engineEmitter.emit(
        EngineEvent.BLOCK_HEIGHT_CHANGED,
        wsAddress,
        value.height
      )
    }
    socket.subscribe({
      ...subscribeNewBlockMessage(),
      cb: socketCb,
      deferred: deferredBlockSub,
      subscribed: false
    })
  }

  function watchAddresses(
    addresses: string[],
    deferredAddressSub: Deferred<unknown>
  ): void {
    const socketCb = async (value: INewTransactionResponse): Promise<void> => {
      engineEmitter.emit(EngineEvent.NEW_ADDRESS_TRANSACTION, wsAddress, value)
    }
    socket.subscribe({
      ...subscribeAddressesMessage(addresses),
      cb: socketCb,
      deferred: deferredAddressSub,
      subscribed: false
    })
  }

  async function broadcastTx(
    transaction: EdgeTransaction
  ): Promise<ITransactionBroadcastResponse> {
    return await promisifyWsMessage(broadcastTxMessage(transaction))
  }

  return instance
}
