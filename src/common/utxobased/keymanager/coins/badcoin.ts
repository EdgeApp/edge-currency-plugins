import { Coin } from '../coin'

export class Badcoin implements Coin {
  name = 'badcoin'
  segwit = false
  coinType = 324
  mainnetConstants = {
    messagePrefix: '\x18Badcoin Signed Message:\n',
    wif: 0xb0,
    legacyXPriv: 0x06c4abc9,
    legacyXPub: 0x06c4abc8,
    pubkeyHash: 0x1c,
    scriptHash: 0x19,
  }

  testnetConstants = {
    messagePrefix: '\x18Badcoin Signed Message:\n',
    wif: 0xef,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    pubkeyHash: 0x6f,
    scriptHash: 0xc4,
  }
}
