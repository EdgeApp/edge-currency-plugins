import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { EngineInfo, PluginInfo } from '../../plugin/types'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'dogecoin',
  walletType: 'wallet:dogecoin',
  currencyCode: 'DOGE',
  displayName: 'Dogecoin',
  denominations: [{ name: 'DOGE', multiplier: '100000000', symbol: 'Ð' }],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [
      'wss://doge1.trezor.io',
      'wss://doge2.trezor.io',
      'wss://doge3.trezor.io',
      'wss://doge4.trezor.io',
      'wss://doge5.trezor.io'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://blockchair.com/dogecoin/address/%s?from=edgeapp',
  blockExplorer: 'https://blockchair.com/dogecoin/block/%s?from=edgeapp',
  transactionExplorer:
    'https://blockchair.com/dogecoin/transaction/%s?from=edgeapp'
}

const engineInfo: EngineInfo = {
  coinType: 3,
  formats: ['bip44', 'bip32'],
  network: 'dogecoin',
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 10000,
  // minRelay: '???',
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '526316',
    lowFee: '526316',
    standardFeeLow: '526316',
    standardFeeHigh: '526316',
    standardFeeLowAmount: '2000000000',
    standardFeeHighAmount: '98100000000'
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo }
