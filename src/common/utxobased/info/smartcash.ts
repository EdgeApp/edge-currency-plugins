import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { EngineInfo, PluginInfo } from '../../plugin/types'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'smartcash',
  walletType: 'wallet:smartcash',
  currencyCode: 'SMART',
  displayName: 'SmartCash',
  denominations: [
    { name: 'SMART', multiplier: '100000000', symbol: 'S' },
    { name: 'mSMART', multiplier: '100000', symbol: 'mS' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://insight.smartcash.cc/address/%s',
  blockExplorer: 'https://insight.smartcash.cc/block/%s',
  transactionExplorer: 'https://insight.smartcash.cc/tx/%s'
}

const engineInfo: EngineInfo = {
  coinType: 224,
  formats: ['bip44', 'bip32'],
  network: 'smartcash',
  gapLimit: 10,
  defaultFee: 100000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '1500',
    lowFee: '200',
    standardFeeLow: '500',
    standardFeeHigh: '1000',
    standardFeeLowAmount: '1732000',
    standardFeeHighAmount: '86700000'
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo }
