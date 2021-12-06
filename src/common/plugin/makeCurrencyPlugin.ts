import {
  EdgeCorePluginOptions,
  EdgeCurrencyEngine,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyPlugin,
  EdgeCurrencyTools,
  EdgeWalletInfo
} from 'edge-core-js/types'

import { makeUtxoEngine } from '../utxobased/engine/makeUtxoEngine'
import { makeCurrencyTools } from './makeCurrencyTools'
import { EngineEmitter, EngineEvent } from './makeEngineEmitter'
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
  const {
    customFeeSettings,
    blockBookServers,
    disableFetchingServers
  } = defaultSettings
  const state = makePluginState({
    io,
    currencyCode,
    pluginId,
    pluginDisklet,
    log,
    defaultSettings: {
      customFeeSettings,
      blockBookServers,
      disableFetchingServers
    }
  })
  return {
    currencyInfo,

    async makeCurrencyEngine(
      walletInfo: EdgeWalletInfo,
      engineOptions: EdgeCurrencyEngineOptions
    ): Promise<EdgeCurrencyEngine> {
      const emitter = new EngineEmitter()
      emitter.on(
        EngineEvent.TRANSACTIONS_CHANGED,
        engineOptions.callbacks.onTransactionsChanged
      )
      emitter.on(
        EngineEvent.WALLET_BALANCE_CHANGED,
        engineOptions.callbacks.onBalanceChanged
      )
      emitter.on(
        EngineEvent.BLOCK_HEIGHT_CHANGED,
        (_uri: string, height: number) => {
          engineOptions.callbacks.onBlockHeightChanged(height)
        }
      )
      emitter.on(
        EngineEvent.ADDRESSES_CHECKED,
        engineOptions.callbacks.onAddressesChecked
      )
      emitter.on(
        EngineEvent.TXIDS_CHANGED,
        engineOptions.callbacks.onTxidsChanged
      )

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
        pluginState: state
      }

      const engine: EdgeCurrencyEngine = await makeUtxoEngine(engineConfig)

      return engine
    },

    async makeCurrencyTools(): Promise<EdgeCurrencyTools> {
      state.load().catch(e => {
        throw e
      })
      return currencyTools
    }
  }
}
