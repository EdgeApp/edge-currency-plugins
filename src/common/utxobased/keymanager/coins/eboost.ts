import { Coin } from '../coin'

export const EBoost: Coin = {
  name: 'eboost',
  segwit: false,
  coinType: 324,
  mainnetConstants: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0xdc,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    pubkeyHash: 0x5c,
    scriptHash: 0x05
  },

  testnetConstants: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0xef,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,

    pubkeyHash: 0x6f,
    scriptHash: 0xc4
  }
}
