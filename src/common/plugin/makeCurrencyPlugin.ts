import {
  EdgeCorePluginOptions,
  EdgeCurrencyEngine,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyPlugin,
  EdgeCurrencyTools,
  EdgeWalletInfo
} from 'edge-core-js/types'

import { makeUtxoEngine } from '../utxobased/engine/makeUtxoEngine'
import { asUtxoUserSettings } from '../utxobased/engine/types'
import { makeCurrencyTools } from './makeCurrencyTools'
import { makeEngineEmitter } from './makeEngineEmitter'
import { makePluginState } from './pluginState'
import { EngineConfig, PluginInfo } from './types'

export function makeCurrencyPlugin(
  pluginOptions: EdgeCorePluginOptions,
  pluginInfo: PluginInfo
): EdgeCurrencyPlugin {
  const { currencyInfo } = pluginInfo
  const { io, log, pluginDisklet } = pluginOptions
  const currencyTools = makeCurrencyTools(io, pluginInfo)
  const { defaultSettings, pluginId, currencyCode } = currencyInfo
  const pluginState = makePluginState({
    io,
    currencyCode,
    pluginId,
    pluginDisklet,
    log,
    defaultSettings: asUtxoUserSettings(defaultSettings)
  })
  return {
    currencyInfo,

    async makeCurrencyEngine(
      walletInfo: EdgeWalletInfo,
      engineOptions: EdgeCurrencyEngineOptions
    ): Promise<EdgeCurrencyEngine> {
      const emitter = makeEngineEmitter(engineOptions.callbacks)
      const engineConfig: EngineConfig = {
        walletInfo,
        pluginInfo,
        pluginDisklet,
        currencyTools,
        io,
        options: {
          ...pluginOptions,
          ...engineOptions,
          emitter
        },
        pluginState
      }
      const engine: EdgeCurrencyEngine = await makeUtxoEngine(engineConfig)

      return engine
    },

    async makeCurrencyTools(): Promise<EdgeCurrencyTools> {
      pluginState.load().catch(e => {
        throw e
      })
      return currencyTools
    }
  }
}
