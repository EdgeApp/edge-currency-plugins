import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { EngineInfo, PluginInfo } from '../../plugin/types'

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
  coinType: 20,
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

export const info: PluginInfo = { currencyInfo, engineInfo }
