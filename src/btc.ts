import { EdgeCorePluginOptions, EdgeCorePlugins } from 'edge-core-js'

import { makeCurrencyPlugin } from './common/plugin/makeCurrencyPlugin'
import { all } from './common/utxobased/info/all'

const plugin: EdgeCorePlugins = {}

for (const info of all) {
  plugin[info.pluginId] = (options: EdgeCorePluginOptions) =>
    makeCurrencyPlugin(options, info)
}

if (typeof window !== 'undefined') {
  window.addEdgeCorePlugins?.(plugin)
}

export default plugin
