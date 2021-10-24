import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { EngineInfo, PluginInfo } from '../../plugin/types'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'groestlcoin',
  walletType: 'wallet:groestlcoin',
  currencyCode: 'GRS',
  displayName: 'Groestlcoin',
  denominations: [
    { name: 'GRS', multiplier: '100000000', symbol: 'G' },
    { name: 'mGRS', multiplier: '100000', symbol: 'mG' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: ['wss://blockbook.groestlcoin.org'],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  addressExplorer:
    'https://blockchair.com/groestlcoin/address/%s?from=edgeapp?from=edgeapp',
  blockExplorer: 'https://blockchair.com/groestlcoin/block/%s?from=edgeapp',
  transactionExplorer:
    'https://blockchair.com/groestlcoin/transaction/%s?from=edgeapp'
}

const engineInfo: EngineInfo = {
  coinType: 17,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  network: 'groestlcoin',
  gapLimit: 10,
  defaultFee: 100000,
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
