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

export const coinInfo: CoinInfo = {
  name: 'feathercoin',
  segwit: true,
  coinType: 8,
  mainnetConstants: {
    messagePrefix: '\x18Feathercoin Signed Message:\n',
    wif: 0x8e,
    legacyXPriv: 0x0488daee,
    legacyXPub: 0x0488bc26,
    wrappedSegwitXPriv: 0x049d7878,
    wrappedSegwitXPub: 0x049d7cb2,
    segwitXPriv: 0x04b2430c,
    segwitXPub: 0x04b24746,
    pubkeyHash: 0x0e,
    scriptHash: 0x05,
    bech32: 'fc'
  },

  testnetConstants: {
    messagePrefix: '\x18Feathercoin Signed Message:\n',
    wif: 0xef,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    wrappedSegwitXPriv: 0x044a4e28,
    wrappedSegwitXPub: 0x044a5262,
    segwitXPriv: 0x045f18bc,
    segwitXPub: 0x045f1cf6,
    pubkeyHash: 0x6f,
    scriptHash: 0xc4,
    bech32: 'tb'
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo, coinInfo }
