import { EdgeCorePluginOptions, EdgeCorePlugins } from 'edge-core-js'

import { makeCurrencyPlugin } from './common/plugin/makeCurrencyPlugin'
import { info } from './common/utxobased/info/bitcoin'

const plugin = {
  [info.pluginId]: (options: EdgeCorePluginOptions) =>
    makeCurrencyPlugin(options, info),
} as EdgeCorePlugins

window?.addEdgeCorePlugins?.(plugin)

export default plugin
