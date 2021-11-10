import { all } from '../info/all'
import { CoinInfo } from './../../plugin/types'

export function getCoinFromString(coinName: string): CoinInfo {
  const pluginInfo = all.find(
    pluginInfo => pluginInfo.coinInfo.name === coinName
  )
  if (pluginInfo == null) {
    throw new Error('Could not find coin info ' + coinName)
  }
  return pluginInfo.coinInfo
}
