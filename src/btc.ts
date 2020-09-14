import { EdgeCorePluginOptions, EdgeCorePlugins } from 'edge-core-js'

import { makeCurrencyPlugin } from './common/plugin/makeCurrencyPlugin'
import { info } from './common/utxobased/info/bitcoin'

export default {
  [info.pluginId]: (options: EdgeCorePluginOptions) =>
    makeCurrencyPlugin(options, info)
} as EdgeCorePlugins
