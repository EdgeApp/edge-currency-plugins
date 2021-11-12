import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'ufo',
  walletType: 'wallet:ufo',
  currencyCode: 'UFO',
  displayName: 'UFO',
  denominations: [
    { name: 'UFO', multiplier: '100000000', symbol: 'Ʉ' },
    { name: 'kUFO', multiplier: '100000000000', symbol: 'kɄ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://explorer.ufobject.com/address/%s',
  blockExplorer: 'https://explorer.ufobject.com/block/%s',
  transactionExplorer: 'https://explorer.ufobject.com/tx/%s'
}

const engineInfo: EngineInfo = {
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  network: 'uniformfiscalobject',
  gapLimit: 10,
  defaultFee: 50000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '2250',
    lowFee: '1000',
    standardFeeLow: '1100',
    standardFeeHigh: '2000',
    standardFeeLowAmount: '51282051282051',
    standardFeeHighAmount: '5128205128205100'
  }
}

export const coinInfo: CoinInfo = {
  name: 'uniformfiscalobject',
  segwit: true,
  coinType: 202,
  mainnetConstants: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0x9b,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    wrappedSegwitXPriv: 0x049d7878,
    wrappedSegwitXPub: 0x049d7cb2,
    segwitXPriv: 0x04b2430c,
    segwitXPub: 0x04b24746,
    pubkeyHash: 0x1b,
    scriptHash: 0x44,
    bech32: 'uf'
  },

  testnetConstants: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
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

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
