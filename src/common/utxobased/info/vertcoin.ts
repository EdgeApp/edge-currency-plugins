import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { EngineInfo, PluginInfo } from '../../plugin/types'

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
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://insight.vertcoin.org/address/%s',
  blockExplorer: 'https://insight.vertcoin.org/block/%s',
  transactionExplorer: 'https://insight.vertcoin.org/tx/%s'
}

const engineInfo: EngineInfo = {
  coinType: 28,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  forks: [],
  network: 'vertcoin',
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

export const info: PluginInfo = { currencyInfo, engineInfo }
