import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { EngineInfo, PluginInfo } from '../../plugin/types'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'ufo',
  walletType: 'wallet:ufo',
  currencyCode: 'UFO',
  displayName: 'UFO',
  denominations: [
    { name: 'UFO', multiplier: '100000000', symbol: 'Ʉ' },
    { name: 'kUFO', multiplier: '100000000000', symbol: 'kɄ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://explorer.ufobject.com/address/%s',
  blockExplorer: 'https://explorer.ufobject.com/block/%s',
  transactionExplorer: 'https://explorer.ufobject.com/tx/%s'
}

const engineInfo: EngineInfo = {
  coinType: 202,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  network: 'uniformfiscalobject',
  gapLimit: 10,
  defaultFee: 50000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '2250',
    lowFee: '1000',
    standardFeeLow: '1100',
    standardFeeHigh: '2000',
    standardFeeLowAmount: '51282051282051',
    standardFeeHighAmount: '5128205128205100'
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo }
