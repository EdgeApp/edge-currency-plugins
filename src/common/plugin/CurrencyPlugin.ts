import { asMaybe } from 'cleaners'
import {
  EdgeCorePluginOptions,
  EdgeCurrencyEngine,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyPlugin,
  EdgeCurrencyTools,
  EdgeWalletInfo
} from 'edge-core-js/types'
import { setMemletConfig } from 'memlet'

import { EdgeCurrencyPluginNativeIo } from '../../react-native'
import {
  asUtxoInitOptions,
  asUtxoUserSettings
} from '../utxobased/engine/types'
import { makeUtxoEngine } from '../utxobased/engine/UtxoEngine'
import { makeCurrencyTools } from './CurrencyTools'
import { makeEngineEmitter } from './EngineEmitter'
import { makePluginState } from './PluginState'
import { asInfoPayload, EngineConfig, PluginInfo } from './types'

let hasMemletBeenSet = false

export function makeCurrencyPlugin(
  pluginOptions: EdgeCorePluginOptions,
  pluginInfo: PluginInfo
): EdgeCurrencyPlugin {
  const { currencyInfo } = pluginInfo
  const { initOptions, io, log, nativeIo, pluginDisklet } = pluginOptions
  const currencyTools = makeCurrencyTools(io, pluginInfo)
  const { defaultSettings, pluginId, currencyCode } = currencyInfo

  const pluginState = makePluginState({
    defaultSettings: asUtxoUserSettings(defaultSettings),
    currencyCode,
    infoPayload: asMaybe(asInfoPayload)(pluginOptions.infoPayload),
    io,
    log,
    pluginId,
    pluginDisklet
  })

  if (!hasMemletBeenSet) {
    const { memletConfig } = nativeIo[
      'edge-currency-plugins'
    ] as EdgeCurrencyPluginNativeIo

    if (memletConfig != null) {
      hasMemletBeenSet = true
      setMemletConfig(memletConfig)
    }
  }

  const instance: EdgeCurrencyPlugin = {
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
        initOptions: asUtxoInitOptions(initOptions),
        io,
        emitter,
        engineOptions: {
          ...engineOptions
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
    },

    async updateInfoPayload(infoPayload) {
      try {
        pluginState.infoPayload = asInfoPayload(infoPayload)
      } catch (_) {
        log.warn('invalid infoPayload', infoPayload)
      }
    }
  }

  return instance
}
