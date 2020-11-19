import { EngineCurrencyInfo, Emitter, LocalWalletMetadata } from '../../plugin/types'
import { BlockBook } from '../network/BlockBook'
import { Account } from '../../Account'

interface UtxoEngineStateConfig {
  currencyInfo: EngineCurrencyInfo
  metadata: LocalWalletMetadata
  account: Account
  emitter: Emitter
  network: BlockBook
}

interface SyncProgress {
  totalCount: number
  processedCount: number
  ratio: number
}

export interface UtxoEngineState {
  start(): Promise<void>

  stop(): Promise<void>

  getFreshChangeAddress(): string
}

export function makeUtxoEngineState(config: UtxoEngineStateConfig): UtxoEngineState {
    return {
    async start(): Promise<void> {
    },

    async stop(): Promise<void> {
    },

    getFreshChangeAddress(): string {
        return ''
    }
  }
}
