import { EdgeCorePluginOptions, EdgeCurrencyPlugin } from 'edge-core-js'
import {
  EdgeCurrencyEngine,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyTools,
  EdgeWalletInfo
} from 'edge-core-js/lib/types/types'

import { makeCurrencyTools } from './makeCurrencyTools'
import { EngineConfig, EngineCurrencyInfo } from './types'

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
      const engineConfig: EngineConfig = {
        walletInfo,
        info,
        tools,
        io,
        options
      }

      let engine!: EdgeCurrencyEngine
      switch (info.coinType) {
      }

      await engine.startEngine()

      return engine
    },

    makeCurrencyTools(): Promise<EdgeCurrencyTools> {
      return Promise.resolve(tools)
    }
  }
}
