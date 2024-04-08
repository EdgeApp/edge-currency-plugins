import { EdgeCorePluginOptions, EdgeCurrencyPlugin } from 'edge-core-js/types'

import { makeCurrencyPlugin } from './common/plugin/CurrencyPlugin'
import { info } from './common/utxobased/info/feathercoin'

const plugin = (options: EdgeCorePluginOptions): EdgeCurrencyPlugin =>
  makeCurrencyPlugin(options, info)

if (typeof window !== 'undefined') {
  window.addEdgeCorePlugins?.({
    [info.currencyInfo.pluginId]: plugin
  })
}

export default plugin
