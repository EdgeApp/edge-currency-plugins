import { EdgeCorePluginOptions, EdgeCorePlugins } from 'edge-core-js'

import { makeCurrencyPlugin } from './common/plugin/makeCurrencyPlugin'
import { info } from './common/utxobased/info/bitcoin'

const plugin: EdgeCorePlugins = {
  [info.pluginId]: (options: EdgeCorePluginOptions) =>
    makeCurrencyPlugin(options, info)
}

if (typeof window !== 'undefined') {
  window.addEdgeCorePlugins?.(plugin)
}

export default plugin
