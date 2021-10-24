import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { EngineInfo, PluginInfo } from '../../plugin/types'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'qtum',
  walletType: 'wallet:qtum',
  currencyCode: 'QTUM',
  displayName: 'Qtum',
  denominations: [{ name: 'QTUM', multiplier: '100000000', symbol: 'Q' }],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://explorer.qtum.org/address/%s',
  blockExplorer: 'https://explorer.qtum.org/block/%s',
  transactionExplorer: 'https://explorer.qtum.org/tx/%s'
}

const engineInfo: EngineInfo = {
  coinType: 2301,
  formats: ['bip44', 'bip32'],
  network: 'qtum',
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '1000',
    lowFee: '400',
    standardFeeLow: '450',
    standardFeeHigh: '700',
    standardFeeLowAmount: '20000000',
    standardFeeHighAmount: '981000000'
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo }
