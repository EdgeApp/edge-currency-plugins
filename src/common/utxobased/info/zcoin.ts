import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { IMAGE_SERVER_URL } from '../../constants'
import { EngineInfo, PluginInfo } from '../../plugin/types'
import { Coin } from '../keymanager/coin'

export const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'zcoin',
  walletType: 'wallet:zcoin',
  displayName: 'Zcoin',
  currencyCode: 'FIRO',
  denominations: [
    { name: 'FIRO', multiplier: '100000000', symbol: 'ƒ' },
    { name: 'mFIRO', multiplier: '100000', symbol: 'mƒ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: ['https://blockbook.zcoin.io/'],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://insight.zcoin.io/address/%s',
  blockExplorer: 'https://insight.zcoin.io/block/%s',
  transactionExplorer: 'https://insight.zcoin.io/tx/%s',

  // Images:
  symbolImage: `${IMAGE_SERVER_URL}/zcoin-logo-solo-64.png`,
  symbolImageDarkMono: `${IMAGE_SERVER_URL}/zcoin-logo-solo-64.png`
}

export const engineInfo: EngineInfo = {
  coinType: 136,
  formats: ['bip44', 'bip32'],
  network: 'zcoin',
  uriPrefix: 'firo',
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

export const coinInfo: Coin = {
  name: 'zcoin',
  segwit: false,
  coinType: 136,
  mainnetConstants: {
    messagePrefix: '\x18Zcoin Signed Message:\n',
    wif: 0xd2,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    pubkeyHash: 0x52,
    scriptHash: 0x7
  },

  testnetConstants: {
    messagePrefix: '\x18Zcoin Signed Message:\n',
    wif: 0xef,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    pubkeyHash: 0x6f,
    scriptHash: 0xc4
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo, coinInfo }
