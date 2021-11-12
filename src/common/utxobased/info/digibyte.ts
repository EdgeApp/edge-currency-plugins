import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'digibyte',
  walletType: 'wallet:digibyte',
  currencyCode: 'DGB',
  displayName: 'DigiByte',
  denominations: [
    { name: 'DGB', multiplier: '100000000', symbol: 'Ɗ' },
    { name: 'mDGB', multiplier: '100000', symbol: 'mƊ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: ['wss://dgb1.trezor.io', 'wss://dgb2.trezor.io'],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://digiexplorer.info/address/%s',
  blockExplorer: 'https://digiexplorer.info/block/%s',
  transactionExplorer: 'https://digiexplorer.info/tx/%s'
}

const engineInfo: EngineInfo = {
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  forks: [],
  network: 'digibyte',
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '150',
    lowFee: '20',
    standardFeeLow: '50',
    standardFeeHigh: '100',
    standardFeeLowAmount: '173200',
    standardFeeHighAmount: '8670000'
  }
}

export const coinInfo: CoinInfo = {
  name: 'digibyte',
  segwit: true,
  coinType: 20,
  mainnetConstants: {
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
  },

  testnetConstants: {
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

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
