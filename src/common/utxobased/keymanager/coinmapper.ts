import { all } from '../info/all'
import { Coin } from './coin'

export function getCoinFromString(coinName: string): Coin {
  const pluginInfo = all.find(
    pluginInfo => pluginInfo.coinInfo.name === coinName
  )
  if (pluginInfo == null) {
    throw new Error('Could not find coin info ' + coinName)
  }
  return pluginInfo.coinInfo
}
