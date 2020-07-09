import { Coin } from '../coin'

export class Dogecoin implements Coin {
  name = 'dogecoin'
  segwit = false
  coinType = 3
  mainnetConstants = {
    messagePrefix: '\x18Dogecoin Signed Message:\n',
    wif: 0x9e,
    legacyXPriv: 0x02fac398,
    legacyXPub: 0x02facafd,
    pubkeyHash: 0x1e,
    scriptHash: 0x16,
  }

  testnetConstants = {
    messagePrefix: '\x18Dogecoin Signed Message:\n',
    wif: 0xef,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    pubkeyHash: 0x6f,
    scriptHash: 0xc4,
  }
}
