import { EdgeCorePluginOptions, EdgeCurrencyPlugin } from 'edge-core-js'
import {
  EdgeCurrencyEngine,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyTools,
  EdgeWalletInfo
} from 'edge-core-js/lib/types/types'

import { UtxoEngine } from '../utxobased/plugin/UtxoEngine'
import {
  CurrencyEngine,
  EngineCoinType,
  EngineConfig,
  EngineCurrencyInfo
} from './CurrencyEngine'
import { CurrencyTools } from './CurrencyTools'

export function makeCurrencyPlugin(
  options: EdgeCorePluginOptions,
  info: EngineCurrencyInfo
): EdgeCurrencyPlugin {
  const { io } = options
  const tools = new CurrencyTools(io, info)

  return {
    currencyInfo: info,

    async makeCurrencyEngine(
      walletInfo: EdgeWalletInfo,
      options: EdgeCurrencyEngineOptions
    ): Promise<EdgeCurrencyEngine> {
      const engineConfig: EngineConfig = {
        walletInfo,
        info,
        tools,
        io,
        options
      }

      let engine: CurrencyEngine
      switch (info.coinType) {
        case EngineCoinType.UTXO:
          engine = new UtxoEngine(engineConfig)
      }

      await engine.load()

      return engine
    },

    makeCurrencyTools(): Promise<EdgeCurrencyTools> {
      return Promise.resolve(tools)
    }
  }
}
