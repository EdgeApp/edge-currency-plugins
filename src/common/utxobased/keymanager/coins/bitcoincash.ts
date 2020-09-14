import * as bitcoin from 'altcoin-js'

import { Coin } from '../coin'

export class BitcoinCash implements Coin {
  name = 'bitcoincash'
  segwit = false
  sighash = bitcoin.Psbt.BCH_SIGHASH_ALL
  coinType = 145

  mainnetConstants = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0x80,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    pubkeyHash: 0x00,
    scriptHash: 0x05,
    cashaddr: 'bitcoincash',
  }

  testnetConstants = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0xef,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    pubkeyHash: 0x6f,
    scriptHash: 0xc4,
    cashaddr: 'bitcoincashtestnet',
  }
}
