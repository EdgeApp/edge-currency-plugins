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

  legacyConstants = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0x80,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    pubkeyHash: 0x00,
    scriptHash: 0x05,
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
