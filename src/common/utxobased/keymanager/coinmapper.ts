import { Coin } from './coin'
import { Badcoin } from './coins/badcoin'
import { Bitcoin } from './coins/bitcoin'
import { BitcoinCash } from './coins/bitcoincash'
import { Bitcoingold } from './coins/bitcoingold'
import { BitcoinSV } from './coins/bitcoinsv'
import { Dash } from './coins/dash'
import { Decred } from './coins/decred'
import { Digibyte } from './coins/digibyte'
import { Dogecoin } from './coins/dogecoin'
import { EBoost } from './coins/eboost'
import { Feathercoin } from './coins/feathercoin'
import { Groestlcoin } from './coins/groestlcoin'
import { Litecoin } from './coins/litecoin'
import { Qtum } from './coins/qtum'
import { Ravencoin } from './coins/ravencoin'
import { Smartcash } from './coins/smartcash'
import { Uniformfiscalobject } from './coins/ufo'
import { Vertcoin } from './coins/vertcoin'
import { ZCash } from './coins/zcash'
import { Zcoin } from './coins/zcoin'

export const coinClasses: Coin[] = [
  new Litecoin(),
  new Bitcoin(),
  new BitcoinCash(),
  new BitcoinSV(),
  new Badcoin(),
  new Bitcoingold(),
  new Dash(),
  new Decred(),
  new Digibyte(),
  new Dogecoin(),
  new EBoost(),
  new Feathercoin(),
  new Groestlcoin(),
  new Litecoin(),
  new Qtum(),
  new Ravencoin(),
  new Smartcash(),
  new Uniformfiscalobject(),
  new Vertcoin(),
  new Zcoin(),
  new ZCash(),
]

export function getCoinFromString(coinName: string): Coin {
  const selectedCoin: Coin | undefined = coinClasses.find(
    (coin) => coin.name === coinName
  )
  if (typeof selectedCoin === 'undefined') {
    throw new Error('Could not find coin ' + coinName)
  }
  return selectedCoin
}
