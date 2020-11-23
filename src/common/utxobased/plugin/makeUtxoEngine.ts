import { EdgeCurrencyCodeOptions, EdgeCurrencyEngine } from 'edge-core-js'
import {
  EdgeDataDump,
  EdgeFreshAddress,
  EdgeGetTransactionsOptions,
  EdgePaymentProtocolInfo,
  EdgeSpendInfo,
  EdgeTokenInfo,
  EdgeTransaction,
  JsonObject,
} from 'edge-core-js/lib/types'
import * as bs from 'biggystring'
import * as bitcoin from 'altcoin-js'

import { EmitterEvent, EngineConfig, LocalWalletMetadata } from '../../plugin/types'
import { makeUtxoEngineState } from './makeUtxoEngineState'
import { makeProcessor } from '../db/Processor'
import { deriveAccount } from '../../plugin/makeCurrencyTools'
import { addressToScriptPubkey, makeTx, MakeTxTarget, signTx } from '../keymanager/keymanager'
import { calculateFeeRate } from './makeSpendHelper'
import { makePathFromString } from '../../Path'
import { makeBlockBook } from '../network/BlockBook'
import { ProcessorTransaction } from '../db/Models/ProcessorTransaction'

const localWalletDataPath = `metadata.json`

async function fetchLocalWalletMetadata(config: EngineConfig): Promise<LocalWalletMetadata> {
  try {
    const dataStr = await config.options.walletLocalDisklet.getText(localWalletDataPath)
    return JSON.parse(dataStr)
  } catch {
    const data: LocalWalletMetadata = {
      balance: '0',
      lastSeenBlockHeight: 0
    }
    await setLocalWalletMetadata(config, data)
    return data
  }
}

async function setLocalWalletMetadata(config: EngineConfig, data: LocalWalletMetadata): Promise<void> {
  await config.options.walletLocalDisklet.setText(localWalletDataPath, JSON.stringify(data))
}

export async function makeUtxoEngine(config: EngineConfig): Promise<EdgeCurrencyEngine> {
  const {
    info,
    walletInfo,
    io,
    options: {
      walletLocalDisklet,
      emitter
    }
  } = config


  const network = makeBlockBook({
    emitter
  })

  const metadata = await fetchLocalWalletMetadata(config)

  const processor = await makeProcessor({
    disklet: walletLocalDisklet,
    emitter
  })
  const account = deriveAccount(info, walletInfo)
  const state = makeUtxoEngineState({
    currencyInfo: info,
    processor,
    metadata,
    account,
    emitter,
    network
  })

  emitter.on(EmitterEvent.PROCESSOR_TRANSACTION_CHANGED, (tx: ProcessorTransaction) => {
    console.log('tx change:', tx)
    emitter.emit(EmitterEvent.TRANSACTIONS_CHANGED, ([
      tx.toEdgeTransaction(info.currencyCode)
    ]))
  })

  emitter.on(EmitterEvent.BALANCE_CHANGED, async (currencyCode: string, nativeBalance: string) => {
    metadata.balance = nativeBalance
    await setLocalWalletMetadata(config, metadata)
  })

  emitter.on(EmitterEvent.BLOCK_HEIGHT_CHANGED, async (height: number) => {
    metadata.lastSeenBlockHeight = height
    await setLocalWalletMetadata(config, metadata)
  })

  const fns: EdgeCurrencyEngine = {
    async startEngine(): Promise<void> {
      await network.connect()

      const { bestHeight } = await network.fetchInfo()
      emitter.emit(EmitterEvent.BLOCK_HEIGHT_CHANGED, bestHeight)

      await state.start()
    },

    async killEngine(): Promise<void> {
      await state.stop()
      await network.disconnect()
    },

    getBalance(opts: EdgeCurrencyCodeOptions): string {
      return ''
    },

    getBlockHeight(): number {
      return 0
    },

    addCustomToken(_token: EdgeTokenInfo): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    addGapLimitAddresses(_addresses: string[]): void {
    },

    async broadcastTx(transaction: EdgeTransaction): Promise<EdgeTransaction> {
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
        walletId: '',
        walletType: '',
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
      return {
        publicAddress: '',
        legacyAddress: '',
        segwitAddress: ''
      }
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
      return []
    },

    isAddressUsed(_address: string): boolean {
      return false
    },

    async makeSpend(edgeSpendInfo: EdgeSpendInfo): Promise<EdgeTransaction> {
    },

    resyncBlockchain(): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    saveTx(_transaction: EdgeTransaction): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    async signTx(transaction: EdgeTransaction): Promise<EdgeTransaction> {
      return transaction
    },

    sweepPrivateKeys(_spendInfo: EdgeSpendInfo): Promise<EdgeTransaction> {
      // @ts-ignore
      return Promise.resolve(undefined)
    }
  }

  return fns
}
