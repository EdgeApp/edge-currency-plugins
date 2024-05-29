import { MemletConfig } from 'memlet'
import { NativeModules } from 'react-native'

const { EdgeCurrencyPluginsModule } = NativeModules
const { sourceUri } = EdgeCurrencyPluginsModule.getConstants()

export const pluginUri = sourceUri
export const debugUri = 'http://localhost:8084/edge-currency-plugins.js'

export interface EdgeCurrencyPluginIoOptions {
  readonly memletConfig?: MemletConfig
}

export interface EdgeCurrencyPluginNativeIo {
  readonly memletConfig?: MemletConfig
}

export function makePluginIo(
  options: EdgeCurrencyPluginIoOptions = {}
): EdgeCurrencyPluginNativeIo {
  const { memletConfig } = options

  return {
    memletConfig
  }
}
