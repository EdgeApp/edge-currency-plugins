import { EdgeCurrencyCodeOptions, EdgeCurrencyEngine } from 'edge-core-js'
import {
  EdgeDataDump,
  EdgeFreshAddress,
  EdgeGetTransactionsOptions,
  EdgePaymentProtocolInfo,
  EdgeSpendInfo,
  EdgeTokenInfo,
  EdgeTransaction,
  JsonObject
} from 'edge-core-js/lib/types'
import * as bs from 'biggystring'
import * as bitcoin from 'altcoin-js'

import { EmitterEvent, EngineConfig } from '../../plugin/types'
import { makeUtxoEngineState } from './makeUtxoEngineState'
import { makeProcessor } from '../db/makeProcessor'
import { makeTx, MakeTxTarget, signTx } from '../keymanager/keymanager'
import { calculateFeeRate } from './makeSpendHelper'
import { makeBlockBook } from '../network/BlockBook'
import { ProcessorTransaction } from '../db/Models/ProcessorTransaction'
import { makeUtxoWalletTools } from './makeUtxoWalletTools'
import { fetchMetadata, setMetadata } from '../../plugin/utils'
import { fetchOrDeriveXprivFromKeys, getXprivKey } from './utils'

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
  const state = makeUtxoEngineState({
    ...config,
    walletTools,
    processor,
    blockBook,
    metadata
  })

  emitter.on(EmitterEvent.PROCESSOR_TRANSACTION_CHANGED, (tx: ProcessorTransaction) => {
    emitter.emit(EmitterEvent.TRANSACTIONS_CHANGED, ([
      tx.toEdgeTransaction(currencyInfo.currencyCode)
    ]))
  })

  emitter.on(EmitterEvent.BALANCE_CHANGED, async (currencyCode: string, nativeBalance: string) => {
    metadata.balance = nativeBalance
    await setMetadata(walletLocalDisklet, metadata)
  })

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

    addCustomToken(_token: EdgeTokenInfo): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    addGapLimitAddresses(_addresses: string[]): void {
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

    getFreshAddress(_opts: EdgeCurrencyCodeOptions): EdgeFreshAddress {
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
      return txs.map((tx) => tx.toEdgeTransaction(currencyInfo.currencyCode))
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

      const { publicAddress: freshChangeAddress } = await state.getFreshAddress(1)
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
      return processor.saveTransaction(ProcessorTransaction.fromEdgeTransaction(tx), false)
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
