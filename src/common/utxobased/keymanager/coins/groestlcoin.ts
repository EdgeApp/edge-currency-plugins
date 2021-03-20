import { crypto } from 'altcoin-js'
import * as bip32grs from 'bip32grs'
import * as base58grs from 'bs58grscheck'
import * as wifgrs from 'wifgrs'

import { Coin } from '../coin'

export class Groestlcoin implements Coin {
  name = 'groestlcoin'
  segwit = true
  coinType = 17
  sighashFunction = crypto.sha256
  bs58DecodeFunc = base58grs.decode
  bs58EncodeFunc = base58grs.encode
  wifEncodeFunc = wifgrs.encode
  bip32FromBase58Func = bip32grs.fromBase58
  bip32FromSeedFunc = bip32grs.fromSeed
  mainnetConstants = {
    messagePrefix: '\x1cGroestlCoin Signed Message:\n',
    wif: 0x80,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    wrappedSegwitXPriv: 0x049d7878,
    wrappedSegwitXPub: 0x049d7cb2,
    segwitXPriv: 0x04b2430c,
    segwitXPub: 0x04b24746,
    pubkeyHash: 0x24,
    scriptHash: 0x05,
    bech32: 'grs'
  }

  testnetConstants = {
    messagePrefix: '\x1cGroestlCoin Signed Message:\n',
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
