import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { IMAGE_SERVER_URL } from '../../constants'
import { EngineInfo, PluginInfo } from '../../plugin/types'
import { info as bitcoincash } from './bitcoincash'
import { info as bitcoingold } from './bitcoingold'

export const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'bitcointestnet',
  walletType: 'wallet:bitcointestnet',
  currencyCode: 'TESTBTC',
  displayName: 'Bitcoin Testnet',
  denominations: [
    { name: 'TESTBTC', multiplier: '100000000', symbol: '₿' },
    { name: 'mTESTBTC', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' },
    { name: 'sats', multiplier: '1', symbol: 's' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [
      'wss://tbtc1.trezor.io/websocket',
      'wss://tbtc2.trezor.io/websocket'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin/testnet/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin/testnet/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin/testnet/transaction/%s',

  // Images:
  symbolImage: `${IMAGE_SERVER_URL}/bitcoin-logo-solo-64.png`,
  symbolImageDarkMono: `${IMAGE_SERVER_URL}/bitcoin-logo-solo-64.png`
}

export const engineInfo: EngineInfo = {
  coinType: 1,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  forks: [bitcoincash, bitcoingold],
  network: 'bitcointestnet',
  gapLimit: 25,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  mempoolSpaceFeeInfoServer: 'https://mempool.space/api/v1/fees/recommended',
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
