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

import { EngineConfig, EngineEvent, LocalWalletMetadata } from '../../plugin/types'
import { makeUtxoEngineState } from './UtxoEngineState'
import { makeProcessor } from '../db/Processor'
import { deriveAccount } from '../../plugin/makeCurrencyTools'

const localWalletDataPath = `metadata.json`
async function fetchLocalWalletMetadata(config: EngineConfig): Promise<LocalWalletMetadata> {
  const disklet = config.options.walletLocalDisklet
  try {
    const dataStr = await disklet.getText(localWalletDataPath)
    return JSON.parse(dataStr)
  } catch {
    const data: LocalWalletMetadata = {
      balance: '0'
    }
    await disklet.setText(localWalletDataPath, JSON.stringify(data))
    return data
  }
}

export async function makeUtxoEngine(config: EngineConfig): Promise<EdgeCurrencyEngine> {
  const {
    info,
    walletInfo,
    options: {
      walletLocalDisklet,
      emitter
    }
  } = config

  const metadata = await fetchLocalWalletMetadata(config)
  let currentBalance = metadata.balance
  let currentBlockHeight = 0

  const processor = await makeProcessor(walletLocalDisklet)
  const account = deriveAccount(info, walletInfo)
  const state = makeUtxoEngineState({
    currencyInfo: info,
    processor,
    account,
    emitter
  })
  emitter.on(EngineEvent.BLOCK_HEIGHT_CHANGED, (height) => {
    currentBlockHeight = height
  })
  emitter.on(EngineEvent.ADDRESSES_CHECKED, async (progressRatio) => {
    if (progressRatio === 1) {
      currentBalance = await processor.fetchBalance()
    }
  })

  const fns: EdgeCurrencyEngine = {
    async startEngine(): Promise<void> {
      await state.start()
    },

    async killEngine(): Promise<void> {
      await state.stop()
    },

    getBalance(opts: EdgeCurrencyCodeOptions): string {
      return currentBalance
    },

    getBlockHeight(): number {
      return currentBlockHeight
    },

    addCustomToken(_token: EdgeTokenInfo): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    addGapLimitAddresses(_addresses: string[]): void {
    },

    broadcastTx(transaction: EdgeTransaction): Promise<EdgeTransaction> {
      return Promise.resolve(transaction)
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
        data: {
        }
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
      // @ts-ignore
      return undefined
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

    getTransactions(_opts: EdgeGetTransactionsOptions): Promise<EdgeTransaction[]> {
      return Promise.resolve([])
    },

    isAddressUsed(_address: string): boolean {
      return false
    },

    makeSpend(_spendInfo: EdgeSpendInfo): Promise<EdgeTransaction> {
      // @ts-ignore
      return Promise.resolve(undefined)
    },

    resyncBlockchain(): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    saveTx(_transaction: EdgeTransaction): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    signTx(_transaction: EdgeTransaction): Promise<EdgeTransaction> {
      // @ts-ignore
      return Promise.resolve(undefined)
    },

    sweepPrivateKeys(_spendInfo: EdgeSpendInfo): Promise<EdgeTransaction> {
      // @ts-ignore
      return Promise.resolve(undefined)
    }
  }

  return fns
}
