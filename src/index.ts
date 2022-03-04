import { EdgeCorePluginOptions, EdgeCorePlugins } from 'edge-core-js/types'

import { makeCurrencyPlugin } from './common/plugin/makeCurrencyPlugin'
import { all } from './common/utxobased/info/all'

const plugins: EdgeCorePlugins = {}

for (const info of all) {
  plugins[info.currencyInfo.pluginId] = (options: EdgeCorePluginOptions) =>
    makeCurrencyPlugin(options, info)
}

if (typeof window !== 'undefined') {
  window.addEdgeCorePlugins?.(plugins)
}

export default plugins

export { setMemletConfig } from 'memlet'
