import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { IMAGE_SERVER_URL } from '../../constants'
import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'

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
  customFeeTemplate: [
    {
      type: 'nativeAmount',
      key: 'satPerByte',
      displayName: 'Satoshis Per Byte',
      displayMultiplier: '0'
    }
  ],
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
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  simpleFeeSettings: {
    highFee: '1200',
    lowFee: '400',
    standardFeeLow: '600',
    standardFeeHigh: '800',
    standardFeeLowAmount: '2000000000',
    standardFeeHighAmount: '98100000000'
  }
}

export const coinInfo: CoinInfo = {
  name: 'feathercoin',
  segwit: true,
  coinType: 8,
  mainnetConstants: {
    messagePrefix: ['\x18Feathercoin Signed Message:\n'],
    wif: [0x8e],
    legacyXPriv: [0x0488daee],
    legacyXPub: [0x0488bc26],
    wrappedSegwitXPriv: [0x049d7878],
    wrappedSegwitXPub: [0x049d7cb2],
    segwitXPriv: [0x04b2430c],
    segwitXPub: [0x04b24746],
    pubkeyHash: [0x0e],
    scriptHash: [0x05],
    bech32: ['fc']
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo, coinInfo }
