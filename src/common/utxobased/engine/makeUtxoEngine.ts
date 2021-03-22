import * as bs from 'biggystring'
import {
  EdgeCurrencyCodeOptions,
  EdgeCurrencyEngine,
  EdgeDataDump,
  EdgeFreshAddress,
  EdgeGetTransactionsOptions,
  EdgePaymentProtocolInfo,
  EdgeSpendInfo,
  EdgeTokenInfo,
  EdgeTransaction,
  JsonObject
} from 'edge-core-js'

import { EmitterEvent, EngineConfig } from '../../plugin/types'
import { clearMetadata, fetchMetadata, setMetadata } from '../../plugin/utils'
import { makeProcessor } from '../db/makeProcessor'
import {
  fromEdgeTransaction,
  toEdgeTransaction
} from '../db/Models/ProcessorTransaction'
import { IProcessorTransaction } from '../db/types'
import { makeTx, MakeTxTarget, signTx } from '../keymanager/keymanager'
import { makeBlockBook } from '../network/BlockBook'
import { calculateFeeRate } from './makeSpendHelper'
import { makeUtxoEngineState } from './makeUtxoEngineState'
import { makeUtxoWalletTools } from './makeUtxoWalletTools'
import { makeMutexor } from './mutexor'
import { createPayment, getPaymentDetails, sendPayment } from './paymentRequest'
import { UTXOTxOtherParams } from './types'
import {
  fetchOrDeriveXprivFromKeys,
  getWalletFormat,
  getWalletSupportedFormats,
  getXprivKey
} from './utils'

export async function makeUtxoEngine(
  config: EngineConfig
): Promise<EdgeCurrencyEngine> {
  const {
    network,
    currencyInfo,
    walletInfo,
    options: { walletLocalDisklet, walletLocalEncryptedDisklet, emitter },
    io
  } = config

  const mutexor = makeMutexor()

  // Merge in the xpriv into the local copy of wallet keys
  walletInfo.keys[
    getXprivKey({ coin: currencyInfo.network })
  ] = await fetchOrDeriveXprivFromKeys({
    keys: walletInfo.keys,
    walletLocalEncryptedDisklet,
    coin: currencyInfo.network,
    network
  })

  const walletTools = makeUtxoWalletTools({
    keys: walletInfo.keys,
    coin: currencyInfo.network,
    network
  })

  const blockBook = makeBlockBook({ emitter })
  let metadata = await fetchMetadata(walletLocalDisklet)
  const processor = await makeProcessor({
    disklet: walletLocalDisklet,
    emitter
  })
  const state = makeUtxoEngineState({
    ...config,
    walletTools,
    processor,
    blockBook,
    metadata
  })

  emitter.on(
    EmitterEvent.PROCESSOR_TRANSACTION_CHANGED,
    async (tx: IProcessorTransaction) => {
      emitter.emit(EmitterEvent.TRANSACTIONS_CHANGED, [
        await toEdgeTransaction({
          tx,
          currencyCode: currencyInfo.currencyCode,
          walletTools,
          processor
        })
      ])
    }
  )

  emitter.on(
    EmitterEvent.BALANCE_CHANGED,
    async (currencyCode: string, nativeBalance: string) => {
      await mutexor('balanceChanged').runExclusive(async () => {
        metadata.balance = nativeBalance
        await setMetadata(walletLocalDisklet, metadata)
      })
    }
  )

  emitter.on(EmitterEvent.BLOCK_HEIGHT_CHANGED, async (height: number) => {
    metadata.lastSeenBlockHeight = height
    await setMetadata(walletLocalDisklet, metadata)
  })

  const fns: EdgeCurrencyEngine = {
    async startEngine(): Promise<void> {
      await blockBook.connect()

      const { bestHeight } = await blockBook.fetchInfo()
      emitter.emit(EmitterEvent.BLOCK_HEIGHT_CHANGED, bestHeight)

      await state.start()
    },

    async killEngine(): Promise<void> {
      await state.stop()
      await blockBook.disconnect()
    },

    getBalance(opts: EdgeCurrencyCodeOptions): string {
      return metadata.balance
    },

    getBlockHeight(): number {
      return metadata.lastSeenBlockHeight
    },

    async addCustomToken(_token: EdgeTokenInfo): Promise<unknown> {
      return await Promise.resolve(undefined)
    },

    async addGapLimitAddresses(addresses: string[]): Promise<void> {
      await state.addGapLimitAddresses(addresses)
    },

    async broadcastTx(transaction: EdgeTransaction): Promise<EdgeTransaction> {
      const { otherParams } = transaction
      if (
        otherParams?.paymentProtocolInfo?.payment != null &&
        otherParams?.paymentProtocolInfo?.paymentUrl != null
      ) {
        const paymentAck = await sendPayment(
          io.fetch,
          otherParams.paymentProtocolInfo.paymentUrl,
          otherParams.paymentProtocolInfo.payment
        )
        if (typeof paymentAck === 'undefined') {
          throw new Error(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `Error when sending to ${otherParams.paymentProtocolInfo.paymentUrl}`
          )
        }
      }
      await blockBook.broadcastTx(transaction)
      return transaction
    },

    async changeUserSettings(_settings: JsonObject): Promise<unknown> {
      return await Promise.resolve(undefined)
    },

    async disableTokens(_tokens: string[]): Promise<unknown> {
      return await Promise.resolve(undefined)
    },

    async dumpData(): Promise<EdgeDataDump> {
      return {
        walletId: walletInfo.id.split(' - ')[0],
        walletType: walletInfo.type,
        data: {
          walletInfo: {
            walletFormat: getWalletFormat(walletInfo),
            walletFormatsSupported: getWalletSupportedFormats(walletInfo),
            pluginType: currencyInfo.pluginId
          },
          state: await processor.dumpData()
        }
      }
    },

    async enableTokens(_tokens: string[]): Promise<unknown> {
      return await Promise.resolve(undefined)
    },

    getDisplayPrivateSeed(): string | null {
      return null
    },

    getDisplayPublicSeed(): string | null {
      return null
    },

    async getEnabledTokens(): Promise<string[]> {
      return await Promise.resolve([])
    },

    getFreshAddress(
      _opts: EdgeCurrencyCodeOptions
    ): Promise<EdgeFreshAddress> | EdgeFreshAddress {
      return state.getFreshAddress()
    },

    getNumTransactions(_opts: EdgeCurrencyCodeOptions): number {
      return processor.getNumTransactions()
    },

    async getPaymentProtocolInfo(
      paymentProtocolUrl: string
    ): Promise<EdgePaymentProtocolInfo> {
      return await getPaymentDetails(
        paymentProtocolUrl,
        network,
        currencyInfo.currencyCode,
        io.fetch
      )
    },

    getTokenStatus(_token: string): boolean {
      return false
    },

    async getTransactions(
      opts: EdgeGetTransactionsOptions
    ): Promise<EdgeTransaction[]> {
      const txs = await processor.fetchTransactions(opts)
      return await Promise.all(
        txs.map(
          async (tx: IProcessorTransaction) =>
            await toEdgeTransaction({
              tx,
              currencyCode: currencyInfo.currencyCode,
              walletTools,
              processor
            })
        )
      )
    },

    async isAddressUsed(address: string): Promise<boolean> {
      const scriptPubkey = walletTools.addressToScriptPubkey(address)
      const addressData = await processor.fetchAddressByScriptPubkey(
        scriptPubkey
      )
      return addressData?.used === true
    },

    async makeSpend(edgeSpendInfo: EdgeSpendInfo): Promise<EdgeTransaction> {
      const targets: MakeTxTarget[] = []
      const ourReceiveAddresses: string[] = []
      for (const target of edgeSpendInfo.spendTargets) {
        if (target.publicAddress == null || target.nativeAmount == null) {
          throw new Error('Invalid spend target')
        }

        const scriptPubkey = walletTools.addressToScriptPubkey(
          target.publicAddress
        )
        if (await processor.hasSPubKey(scriptPubkey)) {
          ourReceiveAddresses.push(target.publicAddress)
        }

        targets.push({
          address: target.publicAddress,
          value: parseInt(target.nativeAmount)
        })
      }

      const freshAddress = await state.getFreshAddress(1)
      const freshChangeAddress =
        freshAddress.segwitAddress ?? freshAddress.publicAddress
      const utxos = await processor.fetchAllUtxos()
      const feeRate = parseInt(calculateFeeRate(currencyInfo, edgeSpendInfo))
      const tx = await makeTx({
        utxos,
        targets,
        feeRate,
        coin: currencyInfo.network,
        network,
        rbf: false,
        freshChangeAddress
      })
      if (tx.changeUsed) {
        ourReceiveAddresses.push(freshChangeAddress)
      }

      let nativeAmount = '0'
      for (const output of tx.outputs) {
        const scriptPubkey = output.script.toString('hex')
        const own = await processor.hasSPubKey(scriptPubkey)
        if (!own) {
          nativeAmount = bs.sub(nativeAmount, output.value.toString())
        }
      }

      const networkFee = tx.fee.toString()
      nativeAmount = bs.sub(nativeAmount, networkFee)

      return {
        ourReceiveAddresses,
        otherParams: {
          psbt: {
            base64: tx.psbtBase64,
            inputs: tx.inputs
          },
          edgeSpendInfo
        },
        currencyCode: currencyInfo.currencyCode,
        txid: '',
        date: 0,
        blockHeight: 0,
        nativeAmount,
        networkFee,
        feeRateUsed: {
          satPerVByte: feeRate
        },
        signedTx: ''
      }
    },

    async resyncBlockchain(): Promise<void> {
      // stops and resets the state
      await state.stop()
      // now get rid of all the db information
      await processor.clearAll()
      metadata = await clearMetadata(walletLocalDisklet)

      // finally restart the state
      await state.start()
    },

    async saveTx(tx: EdgeTransaction): Promise<void> {
      return await processor.saveTransaction(fromEdgeTransaction(tx), false)
    },

    async signTx(transaction: EdgeTransaction): Promise<EdgeTransaction> {
      const { psbt, edgeSpendInfo }: Partial<UTXOTxOtherParams> =
        transaction.otherParams ?? {}
      if (psbt == null || edgeSpendInfo == null)
        throw new Error('Invalid transaction data')

      const privateKeys = await Promise.all(
        psbt.inputs.map(async ({ hash, index }) => {
          const txid = Buffer.isBuffer(hash)
            ? hash.reverse().toString('hex')
            : hash

          const utxo = await processor.fetchUtxo(`${txid}_${index}`)
          if (utxo == null) throw new Error('Invalid UTXO')

          const address = await processor.fetchAddressByScriptPubkey(
            utxo.scriptPubkey
          )
          if (address?.path == null) throw new Error('Invalid script pubkey')

          return walletTools.getPrivateKey(address.path)
        })
      )
      const signedTx = await signTx({
        psbtBase64: psbt.base64,
        coin: currencyInfo.network,
        privateKeys
      })
      transaction.txid = signedTx.id
      transaction.signedTx = signedTx.hex

      const { paymentProtocolInfo } =
        transaction.otherParams?.edgeSpendInfo?.otherParams ?? {}
      if (paymentProtocolInfo != null) {
        const payment = createPayment(
          transaction.signedTx,
          transaction.currencyCode
        )
        Object.assign(transaction.otherParams, {
          paymentProtocolInfo: { ...paymentProtocolInfo, payment }
        })
      }

      return transaction
    },

    async sweepPrivateKeys(
      _spendInfo: EdgeSpendInfo
    ): Promise<EdgeTransaction> {
      // @ts-expect-error
      return await Promise.resolve(undefined)
    }
  }

  return fns
}
