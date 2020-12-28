import * as bitcoin from 'altcoin-js'

import { Coin } from '../coin'

export class Bitcoingold implements Coin {
  name = 'bitcoingold'
  segwit = true
  sighash = bitcoin.Psbt.BTG_SIGHASH_ALL
  coinType = 156

  mainnetConstants = {
    messagePrefix: '\x18Bitcoin Gold Signed Message:\n',
    wif: 0x80,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    wrappedSegwitXPriv: 0x049d7878,
    wrappedSegwitXPub: 0x049d7cb2,
    segwitXPriv: 0x04b2430c,
    segwitXPub: 0x04b24746,
    pubkeyHash: 0x26,
    scriptHash: 0x17,
    bech32: 'btg',
  }

  legacyConstants = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0x80,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    wrappedSegwitXPriv: 0x049d7878,
    wrappedSegwitXPub: 0x049d7cb2,
    segwitXPriv: 0x04b2430c,
    segwitXPub: 0x04b24746,
    pubkeyHash: 0x00,
    scriptHash: 0x05,
    bech32: 'bc',
  }

  testnetConstants = {
    messagePrefix: '\x18Bitcoin Gold Signed Message:\n',
    wif: 0xef,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    wrappedSegwitXPriv: 0x044a4e28,
    wrappedSegwitXPub: 0x044a5262,
    segwitXPriv: 0x045f18bc,
    segwitXPub: 0x045f1cf6,
    pubkeyHash: 0x6f,
    scriptHash: 0xc4,
    bech32: 'btg',
  }
}
