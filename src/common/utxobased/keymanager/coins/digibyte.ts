import { Coin } from '../coin'

export class Digibyte implements Coin {
  name = 'digibyte'
  segwit = true
  coinType = 20
  mainnetConstants = {
    messagePrefix: '\x18Digibyte Signed Message:\n',
    wif: 0x80,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    wrappedSegwitXPriv: 0x049d7878,
    wrappedSegwitXPub: 0x049d7cb2,
    segwitXPriv: 0x04b2430c,
    segwitXPub: 0x04b24746,
    pubkeyHash: 0x1e,
    scriptHash: 0x3f,
    bech32: 'dgb'
  }

  legacyConstants = {
    messagePrefix: '\x18Digibyte Signed Message:\n',
    wif: 0x9e,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    wrappedSegwitXPriv: 0x049d7878,
    wrappedSegwitXPub: 0x049d7cb2,
    segwitXPriv: 0x04b2430c,
    segwitXPub: 0x04b24746,
    pubkeyHash: 0x1e,
    scriptHash: 0x3f,
    bech32: 'dgb'
  }

  testnetConstants = {
    messagePrefix: '\x18Digibyte Signed Message:\n',
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
