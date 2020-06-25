import { Coin } from './coin'
import { Bitcoin } from './coins/bitcoin'
import { BitcoinCash } from './coins/bitcoincash'
import { Litecoin } from './coins/litecoin'

const coinClasses: Coin[] = [new Litecoin(), new Bitcoin(), new BitcoinCash()]

export function getCoinFromString(coinName: string): Coin {
  const selectedCoin: Coin | undefined = coinClasses.find(
    coin => coin.name === coinName
  )
  if (typeof selectedCoin === 'undefined') {
    throw new Error('Could not find coin ' + coinName)
  }
  return selectedCoin
}
