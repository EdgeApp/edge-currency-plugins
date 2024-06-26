import { EdgeCorePluginOptions, EdgeCorePlugins } from 'edge-core-js/types'

import { makeCurrencyPlugin } from './common/plugin/CurrencyPlugin'
import { all } from './common/utxobased/info/all'

const plugins: EdgeCorePlugins = {}

for (const info of all) {
  plugins[info.currencyInfo.pluginId] = (options: EdgeCorePluginOptions) =>
    makeCurrencyPlugin(options, info)
}

declare global {
  interface Window {
    addEdgeCorePlugins?: (plugins: EdgeCorePlugins) => void
  }
}

if (typeof window !== 'undefined') {
  window.addEdgeCorePlugins?.(plugins)
}

export default plugins
