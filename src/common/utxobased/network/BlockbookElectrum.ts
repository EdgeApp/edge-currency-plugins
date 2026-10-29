import { crypto, opcodes, Transaction } from 'altcoin-js'
import {
  asArray,
  asEither,
  asJSON,
  asObject,
  asOptional,
  asString,
  asUnknown,
  Cleaner
} from 'cleaners'
import { EdgeLog } from 'edge-core-js/types'

import { EngineEmitter } from '../../plugin/EngineEmitter'
import { PluginInfo } from '../../plugin/types'
import { UtxoInitOptions } from '../engine/types'
import { addressToScriptPubkey } from '../keymanager/keymanager'
import { Blockbook, makeBlockbook } from './Blockbook'
import {
  AddressResponse,
  BlockbookAccountUtxo,
  BlockbookTransaction,
  SubscribeNewBlockResponse
} from './blockbookApi'
import {
  addressTransactionsMessage,
  AddressTransactionsResponse,
  asHeadersSubscribeResponse,
  broadcastTransactionMessage,
  ElectrumTask,
  headersSubscribeMessage,
  listUnspentMessage,
  ListUnspentResponse,
  pingMessage,
  rawTransactionMessage,
  RawTransactionResponse
} from './electrumApi'
import {
  TaskGeneratorFn,
  WsResponse,
  WsResponseMessage,
  WsTask,
  WsTaskAsyncGenerator
} from './Socket'
import { SocketEmitter } from './SocketEmitter'

export interface BlockbookElectrumConfig {
  asAddress?: Cleaner<string>
  connectionUri: string
  engineEmitter: EngineEmitter
  initOptions: UtxoInitOptions
  log: EdgeLog
  taskGeneratorFn: TaskGeneratorFn
  pluginInfo: PluginInfo
  socketEmitter: SocketEmitter
  walletId: string
}

export interface ElectrumResponseMessage {
  id: number
  data: unknown
  error: { message: string } | undefined
}

const asElectrumMessage = asJSON(
  asEither(
    asObject({
      id: asString,
      result: asUnknown,
      error: asOptional(
        asEither(
          asObject({ message: asString }),
          asObject({ connected: asString })
        )
      )
    }),
    // A subscription's notifications carry its method in place of an id:
    asObject({
      method: asString,
      params: asArray(asUnknown)
    })
  )
)

const { method: headersSubscribeMethod } = headersSubscribeMessage()

const asResponseMessage = (raw: unknown): WsResponseMessage => {
  const message = asElectrumMessage(raw)

  // The socket files each subscription under its method name:
  if ('method' in message) {
    return { id: message.method, data: message.params[0] }
  }

  // Electrum answers a subscription with the current header, not the
  // acknowledgement the socket waits for. fetchInfo reports that height:
  if (message.id === headersSubscribeMethod && message.error == null) {
    return { id: message.id, data: { subscribed: true } }
  }

  return {
    id: message.id,
    data: message.result,
    error: message.error
  }
}

const makeAsResponse = (
  isWatchingBlocks: () => boolean
): Cleaner<WsResponse> => (raw: unknown) => {
  const payloadString = asString(raw).trimEnd()
  const messageStrings = payloadString.split('\n')
  const messages = messageStrings.map(asResponseMessage)

  // fetchInfo's blockchain.headers.subscribe subscribes the connection to new
  // blocks, so the server can announce one before watchBlocks files the
  // subscription. The socket drops connections over messages it cannot route,
  // so announcements until then are skipped. watchBlocks reports each block
  // after it subscribes:
  if (isWatchingBlocks()) return messages
  return messages.filter(message => message.id !== headersSubscribeMethod)
}

export function makeBlockbookElectrum(
  config: BlockbookElectrumConfig
): Blockbook {
  const {
    asAddress,
    connectionUri,
    engineEmitter,
    initOptions,
    log,
    taskGeneratorFn,
    pluginInfo,
    socketEmitter,
    walletId
  } = config
  log(`makeBlockbookElectrum with uri ${connectionUri}`)

  const addressToScriptHash = (address: string): string => {
    const scriptPubkey = addressToScriptPubkey({
      address,
      coin: pluginInfo.coinInfo.name
    })
    return toElectrumScriptHash(Buffer.from(scriptPubkey, 'hex'))
  }

  // Makes the Electrum requests for a Blockbook task, and returns the
  // Blockbook response built from their answers:
  function* translateTask(
    task: WsTask<unknown>
  ): Generator<ElectrumTask<unknown>, unknown, unknown> {
    // Translate getAccountUtxo to blockchain.scripthash.listunspent:
    if (task.method === 'getAccountUtxo') {
      const params = task.params as { descriptor: string }
      const address =
        asAddress != null ? asAddress(params.descriptor) : params.descriptor
      const scriptHash = addressToScriptHash(address)

      // Safe because yielding WsTask<ListUnspentResponse> should get
      // ListUnspentResponse next.
      const electrumUtxos = (yield {
        ...listUnspentMessage(scriptHash)
      }) as ListUnspentResponse

      const blockbookUtxos: BlockbookAccountUtxo[] = electrumUtxos.map(
        utxo => ({
          txid: utxo.tx_hash,
          vout: utxo.tx_pos,
          value: utxo.value.toString(),
          height: utxo.height
        })
      )
      return blockbookUtxos
    }

    // Get Address Transactions:
    if (task.method === 'getAccountInfo') {
      const params = task.params as { descriptor: string }
      const address =
        asAddress != null ? asAddress(params.descriptor) : params.descriptor
      const scriptHash = addressToScriptHash(address)

      // Safe because yielding WsTask<AddressTransactionsResponse> should get
      // AddressTransactionsResponse next.
      const electrumUtxos = (yield {
        ...addressTransactionsMessage(scriptHash)
      }) as AddressTransactionsResponse

      const blockbookUtxos: AddressResponse = {
        address, // unused
        balance: '0', // unused
        totalReceived: '0', // unused
        totalSent: '0', // unused
        txs: electrumUtxos.length,
        unconfirmedBalance: '0', // unused
        unconfirmedTxs: electrumUtxos.reduce(
          // Electrum puts mempool transactions at height 0 or -1:
          (sum, tx) => sum + (tx.height <= 0 ? 1 : 0),
          0
        ),
        txids: [], // unused
        transactions: [], // TODO: this requires an extra query per txid
        page: 0, // unused
        totalPages: 1,
        itemsOnPage: 0 // unused
      }
      return blockbookUtxos
    }

    // Translate getTransaction to blockchain.transaction.get:
    if (task.method === 'getTransaction') {
      const params = task.params as { txid: string }
      return yield* transactionTask(params.txid)
    }

    throw new Error(`${task.method} not supported for Electrum connections`)
  }

  function* transactionTask(
    txid: string
  ): Generator<ElectrumTask<unknown>, BlockbookTransaction, unknown> {
    // Safe because yielding WsTask<RawTransactionResponse> should get
    // RawTransactionResponse next.
    const hex = (yield {
      ...rawTransactionMessage(txid)
    }) as RawTransactionResponse
    const transaction = Transaction.fromHex(hex)

    // Electrum only reports a transaction's height in the history of a
    // script it pays. Servers refuse the history of busy scripts, so each
    // paid script is tried in turn. When none answers the task fails, so the
    // engine retries it instead of taking the transaction as unconfirmed:
    let blockHeight = 0
    let historyError: unknown
    for (const { script } of transaction.outs) {
      if (script[0] === opcodes.OP_RETURN) continue
      try {
        // Safe because yielding WsTask<AddressTransactionsResponse> should get
        // AddressTransactionsResponse next.
        const history = (yield {
          ...addressTransactionsMessage(toElectrumScriptHash(script))
        }) as AddressTransactionsResponse
        blockHeight = history.find(item => item.tx_hash === txid)?.height ?? 0
        historyError = undefined
        break
      } catch (error: unknown) {
        log.warn(`failed to fetch the height of transaction ${txid}:`, error)
        historyError = error
      }
    }
    if (historyError != null) throw historyError

    // The engine reads a fetched transaction's hex, height, outpoints, and
    // outputs. It keeps the date, fee, and input amounts it already stored,
    // which Electrum could only supply with a request per previous transaction:
    const isCoinbase = transaction.isCoinbase()
    return {
      txid,
      hex,
      // Like Blockbook, Electrum puts mempool transactions at height 0 or -1:
      blockHeight,
      confirmations: 0,
      blockTime: 0,
      fees: '0',
      vin: transaction.ins.map((input, n) => ({
        addresses: [],
        n,
        sequence: input.sequence,
        txid: Buffer.from(input.hash).reverse().toString('hex'),
        value: '0',
        vout: input.index,
        coinbase: isCoinbase ? input.script.toString('hex') : undefined
      })),
      vout: transaction.outs.map((output, n) => ({
        n,
        value: output.value.toString(),
        addresses: [], // unused, the engine reads the script in `hex`
        hex: output.script.toString('hex')
      }))
    }
  }

  let isWatchingBlocks = false
  const instance = makeBlockbook({
    asAddress,
    asResponse: makeAsResponse(() => isWatchingBlocks),
    connectionUri,
    engineEmitter,
    initOptions,
    log,
    taskGeneratorFn: async function* (
      uri: string
    ): WsTaskAsyncGenerator<unknown> {
      const generator = taskGeneratorFn(uri)
      let result = await generator.next()

      while (true) {
        // If the generator result is not a WsTask we will return it:
        if (result.done === true) return result.value
        const task = result.value
        if (typeof task === 'boolean') return task

        let response: unknown
        try {
          response = yield* translateTask(task)
        } catch (error: unknown) {
          // Hand the failure to the task that made the request, as the socket
          // does for the requests it sends unchanged:
          result = await generator.throw(error)
          continue
        }
        result = await generator.next(response)
      }
    },
    ping: async (): Promise<void> => {
      return await instance.promisifyWsMessage(pingMessage())
    },
    subscribeNewBlockMessage: () => ({
      ...headersSubscribeMessage(),
      // Notifications hold the header itself, with no response envelope:
      cleaner: (raw: unknown): SubscribeNewBlockResponse => {
        const header = asHeadersSubscribeResponse(raw)
        return { height: header.height, hash: headerToBlockHash(header.hex) }
      }
    }),
    socketEmitter,
    walletId
  })

  instance.broadcastTx = async transaction => {
    const txid = await instance.promisifyWsMessage(
      broadcastTransactionMessage(transaction.signedTx)
    )
    // Blockbook reports the broadcast txid as `result`:
    return { result: txid }
  }
  instance.fetchAddress = async () => {
    throw new Error('fetchAddress not supported for Electrum connections')
  }
  instance.fetchAddressUtxos = async () => {
    throw new Error('fetchAddressUtxos not supported for Electrum connections')
  }
  instance.fetchInfo = async () => {
    const header = await instance.promisifyWsMessage(headersSubscribeMessage())
    return {
      name: pluginInfo.currencyInfo.displayName, // unused
      shortcut: pluginInfo.currencyInfo.currencyCode, // unused
      decimals: 8, // unused
      version: '', // unused
      bestHeight: header.height,
      bestHash: headerToBlockHash(header.hex),
      block0Hash: '', // unused
      testnet: false, // unused
      backend: undefined // unused
    }
  }
  instance.fetchTransaction = async () => {
    throw new Error('fetchTransaction not supported for Electrum connections')
  }

  const { watchBlocks } = instance
  instance.watchBlocks = deferredBlockSub => {
    isWatchingBlocks = true
    watchBlocks(deferredBlockSub)
  }
  instance.watchAddresses = async () => {
    return // Fail gracefully
  }

  return instance
}

// Electrum indexes scripts by their SHA-256, in reverse byte order:
const toElectrumScriptHash = (scriptPubkey: Buffer): string =>
  crypto.sha256(scriptPubkey).reverse().toString('hex')

// A block's hash is its header's double SHA-256, in reverse byte order:
const headerToBlockHash = (headerHex: string): string =>
  crypto.hash256(Buffer.from(headerHex, 'hex')).reverse().toString('hex')
