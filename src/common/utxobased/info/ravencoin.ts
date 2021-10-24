import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { EngineInfo, PluginInfo } from '../../plugin/types'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'ravencoin',
  walletType: 'wallet:ravencoin',
  currencyCode: 'RVN',
  displayName: 'Ravencoin',
  denominations: [{ name: 'RVN', multiplier: '100000000', symbol: 'R' }],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: ['wss://blockbook.ravencoin.org'],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://ravencoin.network/address/%s',
  blockExplorer: 'https://ravencoin.network/block/%s',
  transactionExplorer: 'https://ravencoin.network/tx/%s'
}

const engineInfo: EngineInfo = {
  coinType: 175,
  formats: ['bip44', 'bip32'],
  network: 'ravencoin',
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
