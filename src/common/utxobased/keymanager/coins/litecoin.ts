import { Coin } from '../coin'

export class Litecoin implements Coin {
  name = 'litecoin'
  segwit = true
  coinType = 2
  mainnetConstants = {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    wif: 0xb0,
    legacyXPriv: 0x019d9cfe,
    legacyXPub: 0x019da462,
    wrappedSegwitXPriv: 0x01b26792,
    wrappedSegwitXPub: 0x01b26ef6,
    segwitXPriv: 0x04b2430c,
    segwitXPub: 0x04b24746,
    pubkeyHash: 0x30,
    scriptHash: 0x32,
    legacyPubkeyHash: 0x00,
    legacyScriptHash: 0x05,
    bech32: 'ltc',
  }

  testnetConstants = {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    wif: 0xef,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    wrappedSegwitXPriv: 0x044a4e28,
    wrappedSegwitXPub: 0x044a5262,
    segwitXPriv: 0x045f18bc,
    segwitXPub: 0x045f1cf6,
    pubkeyHash: 0x6f,
    scriptHash: 0x3a,
    bech32: 'tltc',
  }
}
