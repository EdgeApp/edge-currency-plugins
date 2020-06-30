import { Coin } from '../coin'

export class Decred implements Coin {
  name = 'decred'
  segwit = true
  mainnetConstants = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0x22de,
    legacyXPriv: 0x02fda4e8,
    legacyXPub: 0x02fda926,
    wrappedSegwitXPriv: 0x049d7878,
    wrappedSegwitXPub: 0x049d7cb2,
    segwitXPriv: 0x04b2430c,
    segwitXPub: 0x04b24746,
    pubkeyHash: 0x073f,
    scriptHash: 0x071a,
    bech32: 'bc'
  }

  testnetConstants = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0x230e,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    wrappedSegwitXPriv: 0x044a4e28,
    wrappedSegwitXPub: 0x044a5262,
    segwitXPriv: 0x045f18bc,
    segwitXPub: 0x045f1cf6,
    pubkeyHash: 0x0f21,
    scriptHash: 0x0efc,
    bech32: 'tb'
  }
}
