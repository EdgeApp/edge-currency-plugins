import { crypto } from 'altcoin-js'
import {
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
import { AddressResponse, BlockbookAccountUtxo } from './blockbookApi'
import {
  addressTransactionsMessage,
  AddressTransactionsResponse,
  listUnspentMessage,
  ListUnspentResponse,
  pingMessage
} from './electrumApi'
import {
  TaskGeneratorFn,
  WsResponse,
  WsResponseMessage,
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

const asResponseMessage = (raw: unknown): WsResponseMessage => {
  const message = asJSON(
    asObject({
      id: asString,
      result: asUnknown,
      error: asOptional(
        asEither(
          asObject({ message: asString }),
          asObject({ connected: asString })
        )
      )
    })
  )(raw)

  return {
    id: message.id,
    data: message.result,
    error: message.error
  }
}

const asResponse: Cleaner<WsResponse> = (raw: unknown) => {
  const payloadString = asString(raw).trimEnd()
  const messageStrings = payloadString.split('\n')
  const messages = messageStrings.map(asResponseMessage)
  return messages
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
    const scriptHashBuffer = crypto.sha256(Buffer.from(scriptPubkey, 'hex'))
    const scriptHash = scriptHashBuffer.reverse().toString('hex')
    return scriptHash
  }

  const instance = makeBlockbook({
    asAddress,
    asResponse,
    connectionUri,
    engineEmitter,
    initOptions,
    log,
    taskGeneratorFn: async function* (
      uri: string
    ): WsTaskAsyncGenerator<unknown> {
      const generator = taskGeneratorFn(uri)
      let nextValue: unknown

      while (true) {
        const result = await generator.next(nextValue)
        const task = result.value

        // If the generator result is not a WsTask we will return it:
        if (result?.done === true) return result.value
        if (typeof task === 'boolean') return task

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
          nextValue = blockbookUtxos
          continue
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
              (sum, tx) => (sum + tx.height >= 0 ? 1 : 0),
              0
            ),
            txids: [], // unused
            transactions: [], // TODO: this requires an extra query per txid
            page: 0, // unused
            totalPages: 1,
            itemsOnPage: 0 // unused
          }
          nextValue = blockbookUtxos
          continue
        }
      }
    },
    ping: async (): Promise<void> => {
      return await instance.promisifyWsMessage(pingMessage())
    },
    socketEmitter,
    walletId
  })

  instance.broadcastTx = async () => {
    throw new Error('broadcastTx not supported for Electrum connections')
  }
  instance.fetchAddress = async () => {
    throw new Error('fetchAddress not supported for Electrum connections')
  }
  instance.fetchAddressUtxos = async () => {
    throw new Error('fetchAddressUtxos not supported for Electrum connections')
  }
  instance.fetchInfo = async () => {
    throw new Error('fetchInfo not supported for Electrum connections')
  }
  instance.fetchTransaction = async () => {
    throw new Error('fetchTransaction not supported for Electrum connections')
  }

  instance.watchAddresses = async () => {
    return // Fail gracefully
  }
  instance.watchBlocks = async () => {
    return // Fail gracefully
  }

  return instance
}
