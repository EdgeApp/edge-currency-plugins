import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { EngineInfo, PluginInfo } from '../../plugin/types'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'badcoin',
  walletType: 'wallet:badcoin',
  currencyCode: 'BAD',
  displayName: 'Badcoin',
  denominations: [
    { name: 'BAD', multiplier: '100000000', symbol: 'BAD' },
    { name: 'mBAD', multiplier: '100000', symbol: 'mBAD' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://www.blockingbad.com/address/%s',
  blockExplorer: 'https://www.blockingbad.com/block/%s',
  transactionExplorer: 'https://www.blockingbad.com/tx/%s'
}

const engineInfo: EngineInfo = {
  coinType: 324,
  formats: ['bip49', 'bip44', 'bip32'],
  network: 'badcoin',
  gapLimit: 10,
  defaultFee: 500000,
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
