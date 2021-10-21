import { crypto } from 'altcoin-js'
import * as base58smart from 'bs58smartcheck'
import * as wifsmart from 'wif-smart'

import { Coin } from '../coin'

export const Smartcash: Coin = {
  name: 'smartcash',
  segwit: false,
  coinType: 224,
  sighashFunction: crypto.sha256,
  bs58DecodeFunc: base58smart.decode,
  bs58EncodeFunc: base58smart.encode,
  wifEncodeFunc: wifsmart.encode,
  mainnetConstants: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0xbf,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    pubkeyHash: 0x3f,
    scriptHash: 0x12
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
