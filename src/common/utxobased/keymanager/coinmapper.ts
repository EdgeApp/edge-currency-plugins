import { Coin } from './coin'
import { Badcoin } from './coins/badcoin'
import { Bitcoin } from './coins/bitcoin'
import { BitcoinCash } from './coins/bitcoincash'
import { Bitcoingold } from './coins/bitcoingold'
import { BitcoinSV } from './coins/bitcoinsv'
import { BitcoinTestnet } from './coins/bitcointestnet'
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
  Litecoin,
  Bitcoin,
  BitcoinTestnet,
  BitcoinCash,
  BitcoinSV,
  Badcoin,
  Bitcoingold,
  Dash,
  Decred,
  Digibyte,
  Dogecoin,
  EBoost,
  Feathercoin,
  Groestlcoin,
  Litecoin,
  Qtum,
  Ravencoin,
  Smartcash,
  Uniformfiscalobject,
  Vertcoin,
  Zcoin,
  ZCash
]

export function getCoinFromString(coinName: string): Coin {
  const selectedCoin = coinClasses.find(coin => coin.name === coinName)
  if (selectedCoin == null) {
    throw new Error('Could not find coin ' + coinName)
  }
  return selectedCoin
}
