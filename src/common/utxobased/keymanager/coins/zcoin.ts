import { Coin } from '../coin'

export const Zcoin: Coin = {
  name: 'zcoin',
  segwit: false,
  coinType: 136,
  mainnetConstants: {
    messagePrefix: '\x18Zcoin Signed Message:\n',
    wif: 0xd2,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    pubkeyHash: 0x52,
    scriptHash: 0x7
  },

  testnetConstants: {
    messagePrefix: '\x18Zcoin Signed Message:\n',
    wif: 0xef,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    pubkeyHash: 0x6f,
    scriptHash: 0xc4
  }
}
