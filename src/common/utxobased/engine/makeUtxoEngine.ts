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
  EdgeTxidMap,
  JsonObject
} from 'edge-core-js'
import * as bs from 'biggystring'
import * as bitcoin from 'altcoin-js'

import { EmitterEvent, EngineConfig } from '../../plugin/types'
import { makeUtxoEngineState } from './makeUtxoEngineState'
import { makeProcessor } from '../db/Processor'
import { makeTx, MakeTxTarget, signTx } from '../keymanager/keymanager'
import { calculateFeeRate } from './makeSpendHelper'
import { makeBlockBook } from '../network/BlockBook'
import { toEdgeTransaction, toProcessorTransaction } from '../db/Models/ProcessorTransaction'
import { makeUtxoWalletTools } from './makeUtxoWalletTools'
import { fetchMetadata, setMetadata } from '../../plugin/utils'
import { fetchOrDeriveXprivFromKeys, getXprivKey } from './utils'
import { IProcessorTransaction } from '../db/types'

export async function makeUtxoEngine(config: EngineConfig): Promise<EdgeCurrencyEngine> {
  const {
    network,
    currencyInfo,
    walletInfo,
    options: {
      walletLocalDisklet,
      walletLocalEncryptedDisklet,
      emitter
    }
  } = config

  // Merge in the xpriv into the local copy of wallet keys
  walletInfo.keys[getXprivKey({ coin: currencyInfo.network })] = await fetchOrDeriveXprivFromKeys({
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
  const metadata = await fetchMetadata(walletLocalDisklet)
  const processor = await makeProcessor({ disklet: walletLocalDisklet, emitter })
  const state = await makeUtxoEngineState({
    ...config,
    walletTools,
    processor,
    blockBook,
    metadata
  })

  let changedTransactionsMap: { [txid: string]: IProcessorTransaction } = {}
  let changedTxIntervalId: NodeJS.Timeout
  const watchMessages = () => {
    changedTxIntervalId = setInterval(() => {
      const changedTxs: EdgeTransaction[] = []
      const txidMap: EdgeTxidMap = {}
      for (const txid in changedTransactionsMap) {
        console.log('tx changed', txid)
        const tx = changedTransactionsMap[txid]
        const edgeTx = toEdgeTransaction(tx, currencyInfo.currencyCode)
        changedTxs.push(edgeTx)
        txidMap[txid] = tx.date
      }
      changedTransactionsMap = {}

      emitter.emit(EmitterEvent.TRANSACTIONS_CHANGED, changedTxs)
      emitter.emit(EmitterEvent.TXIDS_CHANGED, txidMap)
    }, 5000)
    emitter.on(EmitterEvent.PROCESSOR_TRANSACTION_CHANGED, (tx: IProcessorTransaction) => {
      changedTransactionsMap[tx.txid] = tx
    })

    emitter.on(EmitterEvent.BALANCE_CHANGED, async (currencyCode: string, nativeBalance: string) => {
      // Extra check to avoid race condition
      if (metadata.balance !== nativeBalance) {
        console.log('balance changed', nativeBalance)
        metadata.balance = nativeBalance
        await setMetadata(walletLocalDisklet, metadata)
      }
    })

    emitter.on(EmitterEvent.BLOCK_HEIGHT_CHANGED, async (height: number) => {
      console.log('block height changed', height)
      metadata.lastSeenBlockHeight = height
      await setMetadata(walletLocalDisklet, metadata)
    })
  }
  const stopWatchingMessages = () => {
    clearInterval(changedTxIntervalId)
    emitter.removeAllListeners()
  }

  const fns: EdgeCurrencyEngine = {
    async startEngine(): Promise<void> {
      watchMessages()
      await blockBook.connect()

      const { bestHeight } = await blockBook.fetchInfo()
      emitter.emit(EmitterEvent.BLOCK_HEIGHT_CHANGED, bestHeight)

      await state.start()
    },

    async killEngine(): Promise<void> {
      stopWatchingMessages()
      await state.stop()
      await blockBook.disconnect()
    },

    getBalance(opts: EdgeCurrencyCodeOptions): string {
      return metadata.balance
    },

    getBlockHeight(): number {
      return metadata.lastSeenBlockHeight
    },

    addCustomToken(_token: EdgeTokenInfo): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    addGapLimitAddresses(addresses: string[]): undefined {
      state.addGapLimitAddresses(addresses)
      return
    },

    async broadcastTx(transaction: EdgeTransaction): Promise<EdgeTransaction> {
      await blockBook.broadcastTx(transaction)
      return transaction
    },

    changeUserSettings(_settings: JsonObject): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    disableTokens(_tokens: string[]): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    dumpData(): EdgeDataDump {
      return {
        walletId: walletInfo.id.split(' - ')[0],
        walletType: walletInfo.type,
        // walletFormat: walletInfo.keys && walletInfo.keys.format,
        // pluginType: pluginState.pluginId,
        data: {}
      }
    },

    enableTokens(_tokens: string[]): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    getDisplayPrivateSeed(): string | null {
      return null
    },

    getDisplayPublicSeed(): string | null {
      return null
    },

    getEnabledTokens(): Promise<string[]> {
      return Promise.resolve([])
    },

    getFreshAddress(_opts: EdgeCurrencyCodeOptions): Promise<EdgeFreshAddress> {
      return state.getFreshAddress()
    },

    getNumTransactions(_opts: EdgeCurrencyCodeOptions): number {
      return 0
    },

    getPaymentProtocolInfo(_paymentProtocolUrl: string): Promise<EdgePaymentProtocolInfo> {
      // @ts-ignore
      return Promise.resolve(undefined)
    },

    getTokenStatus(_token: string): boolean {
      return false
    },

    async getTransactions(opts: EdgeGetTransactionsOptions): Promise<EdgeTransaction[]> {
      const txs = await processor.fetchTransactions(opts)
      return txs.map((tx) => toEdgeTransaction(tx, currencyInfo.currencyCode))
    },

    // @ts-ignore
    async isAddressUsed(address: string): Promise<boolean> {
      const scriptPubkey = walletTools.addressToScriptPubkey(address)
      const addressData = await processor.fetchAddressByScriptPubkey(scriptPubkey)
      return !!addressData?.used
    },

    async makeSpend(edgeSpendInfo: EdgeSpendInfo): Promise<EdgeTransaction> {
      const targets: MakeTxTarget[] = []
      const ourReceiveAddresses: string[] = []
      for (const target of edgeSpendInfo.spendTargets) {
        if (!target.publicAddress || !target.nativeAmount) {
          throw new Error('Invalid spend target')
        }

        const scriptPubkey = walletTools.addressToScriptPubkey(target.publicAddress)
        if (await processor.hasSPubKey(scriptPubkey)) {
          ourReceiveAddresses.push(target.publicAddress)
        }

        targets.push({
          address: target.publicAddress,
          value: parseInt(target.nativeAmount)
        })
      }

      const freshAddress = await state.getFreshAddress(true)
      const freshChangeAddress = freshAddress.segwitAddress ?? freshAddress.publicAddress
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
      for (const output of tx.psbt.txOutputs) {
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
          psbt: tx.psbt.toBase64(),
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

    resyncBlockchain(): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    saveTx(tx: EdgeTransaction): Promise<void> {
      return processor.saveTransaction(toProcessorTransaction(tx), false)
    },

    async signTx(transaction: EdgeTransaction): Promise<EdgeTransaction> {
      const { psbt } = transaction!.otherParams!
      const inputs = bitcoin.Psbt.fromBase64(psbt).txInputs
      const privateKeys = await Promise.all(inputs.map(async ({ hash, index }) => {
        const txid = Buffer.isBuffer(hash) ? hash.reverse().toString('hex') : hash

        const utxo = await processor.fetchUtxo(`${txid}_${index}`)
        if (!utxo) throw new Error('Invalid UTXO')

        const address = await processor.fetchAddressByScriptPubkey(utxo.scriptPubkey)
        if (!address?.path) throw new Error('Invalid script pubkey')

        return walletTools.getPrivateKey(address.path)
      }))
      transaction.signedTx = await signTx({
        psbt,
        coin: currencyInfo.network,
        privateKeys
      })

      return transaction
    },

    sweepPrivateKeys(_spendInfo: EdgeSpendInfo): Promise<EdgeTransaction> {
      // @ts-ignore
      return Promise.resolve(undefined)
    }
  }

  return fns
}
