import { EdgeOtherMethods } from 'edge-core-js/types'
import { NativeModules } from 'react-native'

const { EdgeCurrencyPluginsModule } = NativeModules
const { sourceUri } = EdgeCurrencyPluginsModule.getConstants()

export const pluginUri = sourceUri
export const debugUri = 'http://localhost:8081/edge-currency-plugins.js'

export function makePluginIo(): EdgeOtherMethods {
  return {}
}
