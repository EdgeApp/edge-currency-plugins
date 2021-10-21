import { Coin } from '../coin'

export const ZCash: Coin = {
  name: 'zcash',
  segwit: false,
  coinType: 133,
  mainnetConstants: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0x80,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    pubkeyHash: 0x1cb8,
    scriptHash: 0x1cbd
  },

  testnetConstants: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0xef,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    pubkeyHash: 0xef,
    scriptHash: 0x1d25
  }
}
