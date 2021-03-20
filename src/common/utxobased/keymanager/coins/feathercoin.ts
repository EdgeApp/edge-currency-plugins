import { Coin } from '../coin'

export class Feathercoin implements Coin {
  name = 'feathercoin'
  segwit = true
  coinType = 8
  mainnetConstants = {
    messagePrefix: '\x18Feathercoin Signed Message:\n',
    wif: 0x8e,
    legacyXPriv: 0x0488daee,
    legacyXPub: 0x0488bc26,
    wrappedSegwitXPriv: 0x049d7878,
    wrappedSegwitXPub: 0x049d7cb2,
    segwitXPriv: 0x04b2430c,
    segwitXPub: 0x04b24746,
    pubkeyHash: 0x0e,
    scriptHash: 0x05,
    bech32: 'fc'
  }

  testnetConstants = {
    messagePrefix: '\x18Feathercoin Signed Message:\n',
    wif: 0xef,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    wrappedSegwitXPriv: 0x044a4e28,
    wrappedSegwitXPub: 0x044a5262,
    segwitXPriv: 0x045f18bc,
    segwitXPub: 0x045f1cf6,
    pubkeyHash: 0x6f,
    scriptHash: 0xc4,
    bech32: 'tb'
  }
}
