import { Coin } from './coin'
import { Bitcoin } from './coins/bitcoin'
import { Litecoin } from './coins/litecoin'

const coinClasses: Coin[] = [new Litecoin(), new Bitcoin()]

export function getCoinFromString(coinName: string): Coin {
  const selectedCoin = coinClasses.filter(coin => coin.name === coinName)
  if (selectedCoin.length !== 1) {
    throw new Error('Could not find coin ' + coinName)
  }
  return selectedCoin[0]
}
