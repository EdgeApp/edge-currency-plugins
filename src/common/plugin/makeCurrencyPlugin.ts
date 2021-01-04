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
import { EngineCurrencyType, EngineConfig, EngineCurrencyInfo, Emitter, EmitterEvent } from './types'

export function makeCurrencyPlugin(
  pluginOptions: EdgeCorePluginOptions,
  info: EngineCurrencyInfo
): EdgeCurrencyPlugin {
  const { io } = pluginOptions
  const tools = makeCurrencyTools(io, info)

  return {
    currencyInfo: info,

    async makeCurrencyEngine(
      walletInfo: EdgeWalletInfo,
      engineOptions: EdgeCurrencyEngineOptions
    ): Promise<EdgeCurrencyEngine> {
      const emitter: Emitter = new EventEmitter() as any
      emitter.on(EmitterEvent.TRANSACTIONS_CHANGED, engineOptions.callbacks.onTransactionsChanged)
      emitter.on(EmitterEvent.BALANCE_CHANGED, engineOptions.callbacks.onBalanceChanged)
      emitter.on(EmitterEvent.BLOCK_HEIGHT_CHANGED, engineOptions.callbacks.onBlockHeightChanged)
      emitter.on(EmitterEvent.ADDRESSES_CHECKED, engineOptions.callbacks.onAddressesChecked)
      emitter.on(EmitterEvent.TXIDS_CHANGED, engineOptions.callbacks.onTxidsChanged)

      emitter.on(EmitterEvent.ADDRESSES_CHECKED, (progress) => {
        console.log('progress:', progress)
      })

      const engineConfig: EngineConfig = {
        walletInfo,
        info,
        tools,
        io,
        options: {
          ...pluginOptions,
          ...engineOptions,
          emitter
        }
      }

      let engine: EdgeCurrencyEngine
      switch (info.currencyType) {
        case EngineCurrencyType.UTXO:
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
