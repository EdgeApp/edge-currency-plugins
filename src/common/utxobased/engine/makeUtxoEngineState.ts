import * as bs from 'biggystring'
import { EdgeTxidMap, EdgeFreshAddress } from 'edge-core-js'

import { AddressPath, EmitterEvent, EngineConfig, LocalWalletMetadata } from '../../plugin/types'
import { BlockBook, INewTransactionResponse, ITransaction } from '../network/BlockBook'
import { IAddress, IProcessorTransaction, IUTXO } from '../db/types'
import { BIP43PurposeTypeEnum, ScriptTypeEnum } from '../keymanager/keymanager'
import { Processor } from '../db/makeProcessor'
import { UTXOPluginWalletTools } from './makeUtxoWalletTools'
import { getCurrencyFormatFromPurposeType, validScriptPubkeyFromAddress, getPurposeTypeFromKeys, getWalletFormat  } from './utils'

interface SyncProgress {
  totalCount: number
  processedCount: number
  ratio: number
}

export interface UtxoEngineState {
  start(): Promise<void>

  stop(): Promise<void>

  getFreshAddress(branch?: number): EdgeFreshAddress

  markAddressUsed(address: string): Promise<void>
}

export interface UtxoEngineStateConfig extends EngineConfig {
  walletTools: UTXOPluginWalletTools
  processor: Processor
  blockBook: BlockBook
  metadata: LocalWalletMetadata
}

export function makeUtxoEngineState(config: UtxoEngineStateConfig): UtxoEngineState {
  const {
    network,
    currencyInfo,
    walletInfo,
    walletTools,
    options: {
      emitter
    },
    processor,
    blockBook,
    metadata
  } = config


  return {
    async start(): Promise<void> {
    },

    async stop(): Promise<void> {
    },

    getFreshAddress(branch = 0): EdgeFreshAddress {
      return {
        publicAddress: ''
      }
    },

    async markAddressUsed(addressStr: string) {
    }
  }
}
