import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { IMAGE_SERVER_URL } from '../../constants'
import { EngineInfo, PluginInfo } from '../../plugin/types'

export const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'feathercoin',
  walletType: 'wallet:feathercoin',
  displayName: 'Feathercoin',
  currencyCode: 'FTC',
  denominations: [
    { name: 'FTC', multiplier: '100000000', symbol: 'F' },
    { name: 'mFTC', multiplier: '100000', symbol: 'mF' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://fsight.chain.tips/address/%s',
  blockExplorer: 'https://fsight.chain.tips/block/%s',
  transactionExplorer: 'https://fsight.chain.tips/tx/%s',

  // Images:
  symbolImage: `${IMAGE_SERVER_URL}/feathercoin-logo-solo-64.png`,
  symbolImageDarkMono: `${IMAGE_SERVER_URL}/feathercoin-logo-solo-64.png`
}

export const engineInfo: EngineInfo = {
  coinType: 8,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  network: 'feathercoin',
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '1200',
    lowFee: '400',
    standardFeeLow: '600',
    standardFeeHigh: '800',
    standardFeeLowAmount: '2000000000',
    standardFeeHighAmount: '98100000000'
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo }
