import { Cleaner } from 'cleaners'
import { EdgeLog, EdgeTransaction } from 'edge-core-js/types'

import { EngineEmitter, EngineEvent } from '../../plugin/EngineEmitter'
import {
  addressMessage,
  AddressResponse,
  AddresssMessageParams,
  addressUtxosMessage,
  AddressUtxosResponse,
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
} from './blockbookApi'
import Deferred from './Deferred'
import { makeSocket, OnQueueSpaceCB } from './Socket'
import { SocketEmitter } from './SocketEmitter'

export type WatchAddressesCB = (
  response: SubscribeAddressResponse
) => void | Promise<void>
export type WatchBlocksCB = () => void | Promise<void>

export interface Blockbook {
  isConnected: boolean

  connect: () => Promise<void>

  disconnect: () => Promise<void>

  onQueueSpace: (cb: OnQueueSpaceCB) => void

  fetchInfo: () => Promise<InfoResponse>

  fetchAddress: (
    address: string,
    params?: AddresssMessageParams
  ) => Promise<AddressResponse>

  watchAddresses: (
    addresses: string[],
    deferredAddressSub: Deferred<unknown>
  ) => void

  watchBlocks: (deferredBlockSub: Deferred<unknown>) => void

  fetchAddressUtxos: (account: string) => Promise<AddressUtxosResponse>

  fetchTransaction: (hash: string) => Promise<TransactionResponse>

  broadcastTx: (transaction: EdgeTransaction) => Promise<BroadcastTxResponse>
}

interface BlockbookConfig {
  asAddress?: Cleaner<string>
  connectionUri: string
  engineEmitter: EngineEmitter
  log: EdgeLog
  onQueueSpaceCB: OnQueueSpaceCB
  socketEmitter: SocketEmitter
  walletId: string
}

export function makeBlockbook(config: BlockbookConfig): Blockbook {
  const {
    asAddress,
    connectionUri,
    engineEmitter,
    log,
    onQueueSpaceCB,
    socketEmitter,
    walletId
  } = config
  log(`makeBlockbook with uri ${connectionUri}`)

  const instance: Blockbook = {
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

  const socket = makeSocket(connectionUri, {
    healthCheck: ping,
    onQueueSpaceCB,
    log,
    emitter: socketEmitter,
    walletId
  })

  async function connect(): Promise<void> {
    log(`connecting to blockbook socket with uri ${connectionUri}`)
    if (instance.isConnected) return

    await socket.connect()
    instance.isConnected = socket.isConnected()
  }

  async function disconnect(): Promise<void> {
    log(
      `disconnecting from blockbook socket with uri ${connectionUri}, currently connected: ${instance.isConnected}`
    )
    if (!instance.isConnected) return

    socket.disconnect()
    instance.isConnected = false
  }

  function onQueueSpace(cb: OnQueueSpaceCB): void {
    socket.onQueueSpace(cb)
  }

  async function promisifyWsMessage<T>(message: BlockbookTask<T>): Promise<T> {
    const deferred = new Deferred<T>()
    socket.submitTask<T>({ ...message, deferred })
    return await deferred.promise
  }

  async function ping(): Promise<void> {
    await promisifyWsMessage(pingMessage())
  }

  async function fetchInfo(): Promise<InfoResponse> {
    return await promisifyWsMessage(infoMessage())
  }

  async function fetchAddressUtxos(
    account: string
  ): Promise<AddressUtxosResponse> {
    return await promisifyWsMessage(addressUtxosMessage(account))
  }

  async function fetchTransaction(hash: string): Promise<TransactionResponse> {
    return await promisifyWsMessage(transactionMessage(hash))
  }

  async function fetchAddress(
    address: string,
    params: AddresssMessageParams = {}
  ): Promise<AddressResponse> {
    return await promisifyWsMessage(addressMessage(address, asAddress, params))
  }

  async function watchBlocks(
    deferredBlockSub: Deferred<unknown>
  ): Promise<void> {
    const socketCb = async (res: SubscribeNewBlockResponse): Promise<void> => {
      engineEmitter.emit(
        EngineEvent.BLOCK_HEIGHT_CHANGED,
        connectionUri,
        res.height
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
    const socketCb = async (res: SubscribeAddressResponse): Promise<void> => {
      engineEmitter.emit(
        EngineEvent.NEW_ADDRESS_TRANSACTION,
        connectionUri,
        res
      )
    }
    socket.subscribe({
      ...subscribeAddressesMessage(addresses, asAddress),
      cb: socketCb,
      deferred: deferredAddressSub,
      subscribed: false
    })
  }

  async function broadcastTx(
    transaction: EdgeTransaction
  ): Promise<BroadcastTxResponse> {
    return await promisifyWsMessage(broadcastTxMessage(transaction.signedTx))
  }

  return instance
}
