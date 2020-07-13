import * as cryptob from 'crypto-browserify'

import * as base58 from '../base'
import { Coin } from '../coin'

export class Decred implements Coin {
  name = 'decred'
  segwit = false
  coinType = 42
  sighashFunction = blake256
  bs58DecodeFunc = base58.base58Base(doubleblake256).decode
  bs58EncodeFunc = base58.base58Base(doubleblake256).encode
  mainnetConstants = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0x22de,
    legacyXPriv: 0x02fda4e8,
    legacyXPub: 0x02fda926,
    pubkeyHash: 0x073f,
    scriptHash: 0x071a,
  }

  testnetConstants = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0x230e,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    pubkeyHash: 0x0f21,
    scriptHash: 0x0efc,
  }
}

function doubleblake256(buffer: Buffer): Buffer {
  return blake256(blake256(buffer))
}

function blake256(buffer: Buffer): Buffer {
  return cryptob.createHash('blake256').update(buffer).digest()
}
