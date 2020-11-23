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

import { EngineConfig } from '../../plugin/types'

export async function makeUtxoEngine(config: EngineConfig): Promise<EdgeCurrencyEngine> {
  const fns: EdgeCurrencyEngine = {
    async startEngine(): Promise<void> {

    },

    async killEngine(): Promise<void> {

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
      await network.broadcastTx(transaction)
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
      const freshAddress = state.getFreshChangeAddress()
      return {
        publicAddress: freshAddress
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
      // TODO: Update RangeBase to paginate
      const start = opts.startDate?.getTime() ?? Date.now() / 2
      const txs = await processor.fetchTransactionsByDate(start)
      return txs.map((tx) => tx.toEdgeTransaction(info.currencyCode))
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
