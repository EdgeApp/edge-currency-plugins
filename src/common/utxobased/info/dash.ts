import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { EngineInfo, PluginInfo } from '../../plugin/types'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'dash',
  walletType: 'wallet:dash',
  currencyCode: 'DASH',
  displayName: 'Dash',
  denominations: [
    { name: 'DASH', multiplier: '100000000', symbol: 'Ð' },
    { name: 'mDASH', multiplier: '100000', symbol: 'mÐ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [
      'wss://dash1.trezor.io',
      'wss://dash2.trezor.io',
      'wss://dash3.trezor.io',
      'wss://dash4.trezor.io',
      'wss://dash5.trezor.io'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://blockchair.com/dash/address/%s?from=edgeapp',
  blockExplorer: 'https://blockchair.com/dash/block/%s?from=edgeapp',
  transactionExplorer: 'https://blockchair.com/dash/transaction/%s?from=edgeapp'
}

const engineInfo: EngineInfo = {
  coinType: 5,
  formats: ['bip44', 'bip32'],
  network: 'dash',
  gapLimit: 10,
  defaultFee: 10000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '300',
    lowFee: '100',
    standardFeeLow: '150',
    standardFeeHigh: '200',
    standardFeeLowAmount: '20000000',
    standardFeeHighAmount: '981000000'
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo }
