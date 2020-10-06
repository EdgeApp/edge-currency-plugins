import { EventEmitter } from 'events'
import { EdgeCorePluginOptions, EdgeCurrencyPlugin } from 'edge-core-js'
import {
  EdgeCurrencyEngine,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyTools,
  EdgeWalletInfo
} from 'edge-core-js/lib/types/types'

import { makeCurrencyTools } from './makeCurrencyTools'
import { makeUtxoEngine } from '../utxobased/plugin/makeUtxoEngine'
import { EngineCoinType, EngineConfig, EngineCurrencyInfo, EngineEmitter, EngineEvent } from './types'

export function makeCurrencyPlugin(
  options: EdgeCorePluginOptions,
  info: EngineCurrencyInfo
): EdgeCurrencyPlugin {
  const { io } = options
  const tools = makeCurrencyTools(io, info)

  return {
    currencyInfo: info,

    async makeCurrencyEngine(
      walletInfo: EdgeWalletInfo,
      options: EdgeCurrencyEngineOptions
    ): Promise<EdgeCurrencyEngine> {
      const emitter: EngineEmitter = new EventEmitter() as any
      emitter.on(EngineEvent.TRANSACTIONS_CHANGED, options.callbacks.onTransactionsChanged)
      emitter.on(EngineEvent.BLOCK_HEIGHT_CHANGED, options.callbacks.onBlockHeightChanged)
      emitter.on(EngineEvent.ADDRESSES_CHECKED, options.callbacks.onAddressesChecked)
      emitter.on(EngineEvent.TXIDS_CHANGED, options.callbacks.onTxidsChanged)

      const engineConfig: EngineConfig = {
        walletInfo,
        info,
        tools,
        io,
        options: {
          ...options,
          emitter
        }
      }

      let engine: EdgeCurrencyEngine
      switch (info.coinType) {
        case EngineCoinType.UTXO:
          engine = await makeUtxoEngine(engineConfig)
          break
      }

      return engine
    },

    makeCurrencyTools(): Promise<EdgeCurrencyTools> {
      return Promise.resolve(tools)
    }
  }
}
