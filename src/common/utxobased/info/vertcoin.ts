import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'vertcoin',
  walletType: 'wallet:vertcoin',
  currencyCode: 'VTC',
  displayName: 'Vertcoin',
  denominations: [
    { name: 'VTC', multiplier: '100000000', symbol: 'V' },
    { name: 'mVTC', multiplier: '100000', symbol: 'mV' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [
      'wss://vtc1.trezor.io',
      'wss://vtc2.trezor.io',
      'wss://vtc3.trezor.io',
      'wss://vtc4.trezor.io',
      'wss://vtc5.trezor.io'
    ],
    disableFetchingServers: false
  },
  customFeeTemplate: [
    {
      type: 'nativeAmount',
      key: 'satPerByte',
      displayName: 'Satoshis Per Byte',
      displayMultiplier: '0'
    }
  ],
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://insight.vertcoin.org/address/%s',
  blockExplorer: 'https://insight.vertcoin.org/block/%s',
  transactionExplorer: 'https://insight.vertcoin.org/tx/%s'
}

const engineInfo: EngineInfo = {
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  forks: [],
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
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
  name: 'vertcoin',
  segwit: true,
  coinType: 28,
  mainnetConstants: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0x80,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    wrappedSegwitXPriv: 0x0488ade4,
    wrappedSegwitXPub: 0x0488b21e,
    segwitXPriv: 0x0488ade4,
    segwitXPub: 0x0488b21e,
    pubkeyHash: 0x47,
    scriptHash: 0x05,
    bech32: 'vtc'
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
