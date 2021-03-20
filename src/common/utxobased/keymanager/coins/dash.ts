import { Coin } from '../coin'

export class Dash implements Coin {
  name = 'dash'
  segwit = false
  coinType = 5
  mainnetConstants = {
    messagePrefix: 'unused',
    wif: 0xcc,
    legacyXPriv: 0x02fe52f8,
    legacyXPub: 0x02fe52cc,
    pubkeyHash: 0x4c,
    scriptHash: 0x10
  }

  testnetConstants = {
    messagePrefix: 'unused',
    wif: 0xef,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    pubkeyHash: 0x6f,
    scriptHash: 0xc4
  }
}
