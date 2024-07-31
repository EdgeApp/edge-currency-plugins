import { Cleaner } from 'cleaners'
import { EdgeLog, EdgeTransaction } from 'edge-core-js/types'

import { EngineEmitter, EngineEvent } from '../../plugin/EngineEmitter'
import { BLOCKBOOK_TXS_PER_PAGE } from '../engine/constants'
import {
  addressMessage,
  AddressResponse,
  AddresssMessageParams,
  addressUtxosMessage,
  AddressUtxosResponse,
  BlockbookTask,
  BlockbookTransaction,
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
  transactionMessageSpecific,
  TransactionResponse
} from './blockbookApi'
import Deferred from './Deferred'
import {
  makeSocket,
  TaskGeneratorFn,
  WsResponse,
  WsTask,
  WsTaskGenerator
} from './Socket'
import { SocketEmitter } from './SocketEmitter'

export type WatchAddressesCB = (
  response: SubscribeAddressResponse
) => void | Promise<void>
export type WatchBlocksCB = () => void | Promise<void>

export interface Blockbook {
  isConnected: boolean

  broadcastTx: (transaction: EdgeTransaction) => Promise<BroadcastTxResponse>

  connect: () => Promise<void>

  disconnect: () => Promise<void>

  fetchAddress: (
    address: string,
    params?: AddresssMessageParams
  ) => Promise<AddressResponse>

  fetchAddressUtxos: (account: string) => Promise<AddressUtxosResponse>

  fetchInfo: () => Promise<InfoResponse>

  fetchTransaction: (hash: string) => Promise<TransactionResponse>

  watchAddresses: (
    addresses: string[],
    deferredAddressSub: Deferred<unknown>
  ) => void

  watchBlocks: (deferredBlockSub: Deferred<unknown>) => void

  promisifyWsMessage: <T>(message: BlockbookTask<T>) => Promise<T>

  //
  // Task Methods:
  //

  addressQueryTask: (
    address: string,
    params: {
      asBlockbookAddress?: Cleaner<string> | undefined
      lastQueriedBlockHeight: number
      page: number
    }
  ) => WsTaskGenerator<AddressResponse>

  transactionQueryTask: (txId: string) => WsTaskGenerator<BlockbookTransaction>

  transactionSpecialQueryTask: (txId: string) => WsTaskGenerator<unknown>

  utxoListQueryTask: (
    address: string,
    params: {
      asBlockbookAddress?: Cleaner<string> | undefined
    }
  ) => WsTaskGenerator<AddressUtxosResponse>
}

interface BlockbookConfig {
  asAddress?: Cleaner<string>
  asResponse?: Cleaner<WsResponse>
  connectionUri: string
  engineEmitter: EngineEmitter
  log: EdgeLog
  taskGeneratorFn: TaskGeneratorFn
  ping?: () => Promise<void>
  socketEmitter: SocketEmitter
  walletId: string
}

export function makeBlockbook(config: BlockbookConfig): Blockbook {
  const {
    asAddress,
    asResponse,
    connectionUri,
    engineEmitter,
    log,
    taskGeneratorFn,
    socketEmitter,
    walletId
  } = config
  log(`makeBlockbook with uri ${connectionUri}`)

  const instance: Blockbook = {
    isConnected: false,

    async broadcastTx(
      transaction: EdgeTransaction
    ): Promise<BroadcastTxResponse> {
      return await instance.promisifyWsMessage(
        broadcastTxMessage(transaction.signedTx)
      )
    },

    async connect(): Promise<void> {
      log(`connecting to blockbook socket with uri ${connectionUri}`)
      if (instance.isConnected) return

      await socket.connect()
      instance.isConnected = socket.isConnected()
    },

    async disconnect(): Promise<void> {
      log(
        `disconnecting from blockbook socket with uri ${connectionUri}, currently connected: ${instance.isConnected}`
      )
      if (!instance.isConnected) return

      socket.disconnect()
      instance.isConnected = false
    },

    async fetchAddress(
      address: string,
      params: AddresssMessageParams = {}
    ): Promise<AddressResponse> {
      return await instance.promisifyWsMessage(
        addressMessage(address, asAddress, params)
      )
    },

    async fetchAddressUtxos(account: string): Promise<AddressUtxosResponse> {
      return await instance.promisifyWsMessage(addressUtxosMessage(account))
    },

    async fetchInfo(): Promise<InfoResponse> {
      return await instance.promisifyWsMessage(infoMessage())
    },

    async fetchTransaction(hash: string): Promise<TransactionResponse> {
      return await instance.promisifyWsMessage(transactionMessage(hash))
    },

    async promisifyWsMessage<T>(message: BlockbookTask<T>): Promise<T> {
      const deferred = new Deferred<T>()
      const taskGeneratorFn = async function* (): AsyncGenerator<
        WsTask<T>,
        false,
        T
      > {
        const value = yield { ...message }
        deferred.resolve(value)
        return false
      }
      const generator = taskGeneratorFn()
      const result = await generator.next()
      // Assertion mask the type checker
      if (result.done !== true) {
        const task = result.value
        socket.submitTask<T>(task, generator)
      }
      return await deferred.promise
    },

    watchAddresses(
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
    },

    async watchBlocks(deferredBlockSub: Deferred<unknown>): Promise<void> {
      const socketCb = async (
        res: SubscribeNewBlockResponse
      ): Promise<void> => {
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
    },

    //
    // Task Methods:
    //

    addressQueryTask: function* (address, params) {
      return yield {
        ...addressMessage(address, params.asBlockbookAddress, {
          details: 'txs',
          from: params.lastQueriedBlockHeight,
          pageSize: BLOCKBOOK_TXS_PER_PAGE,
          page: params.page
        })
      }
    },

    transactionQueryTask: function* (txId) {
      return yield {
        ...transactionMessage(txId)
      }
    },

    transactionSpecialQueryTask: function* (txId: string) {
      return yield {
        ...transactionMessageSpecific(txId)
      }
    },

    utxoListQueryTask: function* (address, params) {
      return yield {
        ...addressUtxosMessage(address, params.asBlockbookAddress)
      }
    }
  }

  const socket = makeSocket(connectionUri, {
    asResponse,
    healthCheck: config.ping ?? ping,
    taskGeneratorFn,
    log,
    emitter: socketEmitter,
    walletId
  })

  async function ping(): Promise<void> {
    await instance.promisifyWsMessage(pingMessage())
  }

  return instance
}
