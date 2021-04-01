import { EdgeCorePluginOptions, EdgeCurrencyPlugin } from 'edge-core-js'
import {
  EdgeCurrencyEngine,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyTools,
  EdgeWalletInfo
} from 'edge-core-js/lib/types/types'

import { makeUtxoEngine } from '../utxobased/engine/makeUtxoEngine'
import { makeCurrencyTools } from './makeCurrencyTools'
import { EngineEmitter, EngineEvent } from './makeEngineEmitter'
import {
  EngineConfig,
  EngineCurrencyInfo,
  EngineCurrencyType,
  NetworkEnum
} from './types'

export function makeCurrencyPlugin(
  pluginOptions: EdgeCorePluginOptions,
  currencyInfo: EngineCurrencyInfo
): EdgeCurrencyPlugin {
  const { io } = pluginOptions
  const currencyTools = makeCurrencyTools(io, currencyInfo)

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
        engineOptions.callbacks.onBlockHeightChanged
      )
      emitter.on(
        EngineEvent.ADDRESSES_CHECKED,
        engineOptions.callbacks.onAddressesChecked
      )
      emitter.on(
        EngineEvent.TXIDS_CHANGED,
        engineOptions.callbacks.onTxidsChanged
      )

      const network = NetworkEnum.Mainnet

      const engineConfig: EngineConfig = {
        network,
        walletInfo,
        currencyInfo,
        currencyTools,
        io,
        options: {
          ...pluginOptions,
          ...engineOptions,
          emitter
        }
      }

      let engine: EdgeCurrencyEngine
      switch (currencyInfo.currencyType) {
        case EngineCurrencyType.UTXO:
          engine = await makeUtxoEngine(engineConfig)
          break
      }

      return engine
    },

    async makeCurrencyTools(): Promise<EdgeCurrencyTools> {
      return currencyTools
    }
  }
}
