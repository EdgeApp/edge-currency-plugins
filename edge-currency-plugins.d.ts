import { EdgeCorePluginOptions, EdgeCurrencyPlugin } from 'edge-core-js/types'

import {
  EdgeCurrencyPluginIoOptions,
  EdgeCurrencyPluginNativeIo
} from './src/react-native'

/**
 * Add this to your `nativeIo` object on React Native,
 * as `{ 'edge-currency-plugins': makePluginIo() }`
 */
export function makePluginIo(
  options?: EdgeCurrencyPluginIoOptions
): EdgeCurrencyPluginNativeIo

/**
 * Debugging-URI to use on React Native,
 * along with running `yarn start` in this repo.
 */
export const debugUri: string

/* Regular URI to use on React Native. */
export const pluginUri: string

type EdgeCorePluginFactory = (env: EdgeCorePluginOptions) => EdgeCurrencyPlugin

/**
 * The Node.js default export.
 */
declare const plugins: {
  [pluginId: string]: EdgeCorePluginFactory
}

export default plugins
