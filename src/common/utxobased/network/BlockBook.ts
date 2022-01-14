import { Cleaner } from 'cleaners'
import { EdgeLog, EdgeTransaction } from 'edge-core-js/types'

import { EngineEmitter, EngineEvent } from '../../plugin/makeEngineEmitter'
import {
  addressMessage,
  AddresssMessageParams,
  addressUtxosMessage,
  AddressUtxosResponse,
  asAddressUtxosResponse,
  asBroadcastTxResponse,
  asInfoResponse,
  asSubscribeAddressResponse,
  asSubscribeNewBlockResponse,
  asTransactionResponse,
  BlockbookTask,
  broadcastTxMessage,
  BroadcastTxResponse,
  infoMessage,
  InfoResponse,
  pingMessage,
  subscribeAddressesMessage,
  SubscribeAddressResponse,
  subscribeNewBlockMessage,
  SubscribeNewBlockResponse,
  transactionMessage,
  TransactionResponse
} from './BlockBookAPI'
import Deferred from './Deferred'
import { SocketEmitter } from './MakeSocketEmitter'
import { makeSocket, OnQueueSpaceCB } from './Socket'

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
  transactions?: TransactionResponse[]
}

export type WatchAddressesCB = (
  response: SubscribeAddressResponse
) => void | Promise<void>
export type WatchBlocksCB = () => void | Promise<void>

export interface BlockBook {
  isConnected: boolean

  connect: () => Promise<void>

  disconnect: () => Promise<void>

  onQueueSpace: (cb: OnQueueSpaceCB) => void

  fetchInfo: () => Promise<InfoResponse>

  fetchAddress: ((
    address: string,
    params?: AddresssMessageParams & {
      details?: 'basic'
    }
  ) => Promise<IAccountDetailsBasic>) &
    ((
      address: string,
      params: AddresssMessageParams & {
        details: 'txids'
      }
    ) => Promise<ITransactionIdPaginationResponse>) &
    ((
      address: string,
      params: AddresssMessageParams & {
        details: 'txs'
      }
    ) => Promise<ITransactionDetailsPaginationResponse>) &
    ((
      address: string,
      params?: AddresssMessageParams
    ) => Promise<IAccountDetailsBasic>)

  watchAddresses: (
    addresses: string[],
    deferredAddressSub: Deferred<unknown>
  ) => void

  watchBlocks: (deferredBlockSub: Deferred<unknown>) => void

  fetchAddressUtxos: (account: string) => Promise<AddressUtxosResponse>

  fetchTransaction: (hash: string) => Promise<TransactionResponse>

  broadcastTx: (transaction: EdgeTransaction) => Promise<BroadcastTxResponse>
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

  async function promisifyWsMessage<T>(
    message: BlockbookTask,
    cleaner?: Cleaner<T>
  ): Promise<T> {
    const deferred = new Deferred<T>()
    socket.submitTask({ ...message, cleaner, deferred })
    return await deferred.promise
  }

  async function ping(): Promise<never> {
    return await promisifyWsMessage(pingMessage())
  }

  async function fetchInfo(): Promise<InfoResponse> {
    return await promisifyWsMessage(infoMessage(), asInfoResponse)
  }

  async function fetchAddressUtxos(
    account: string
  ): Promise<AddressUtxosResponse> {
    return await promisifyWsMessage(
      addressUtxosMessage(account),
      asAddressUtxosResponse
    )
  }

  async function fetchTransaction(hash: string): Promise<TransactionResponse> {
    return await promisifyWsMessage(
      transactionMessage(hash),
      asTransactionResponse
    )
  }

  async function fetchAddress(
    address: string,
    params: AddresssMessageParams = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    return await promisifyWsMessage(addressMessage(address, params))
  }

  async function watchBlocks(
    deferredBlockSub: Deferred<unknown>
  ): Promise<void> {
    const socketCb = async (
      value: SubscribeNewBlockResponse
    ): Promise<void> => {
      engineEmitter.emit(
        EngineEvent.BLOCK_HEIGHT_CHANGED,
        wsAddress,
        value.height
      )
    }
    socket.subscribe({
      ...subscribeNewBlockMessage(),
      cb: socketCb,
      cleaner: asSubscribeNewBlockResponse,
      deferred: deferredBlockSub,
      subscribed: false
    })
  }

  function watchAddresses(
    addresses: string[],
    deferredAddressSub: Deferred<unknown>
  ): void {
    const socketCb = async (value: SubscribeAddressResponse): Promise<void> => {
      engineEmitter.emit(EngineEvent.NEW_ADDRESS_TRANSACTION, wsAddress, value)
    }
    socket.subscribe({
      ...subscribeAddressesMessage(addresses),
      cb: socketCb,
      cleaner: asSubscribeAddressResponse,
      deferred: deferredAddressSub,
      subscribed: false
    })
  }

  async function broadcastTx(
    transaction: EdgeTransaction
  ): Promise<BroadcastTxResponse> {
    return await promisifyWsMessage(
      broadcastTxMessage(transaction),
      asBroadcastTxResponse
    )
  }

  return instance
}
