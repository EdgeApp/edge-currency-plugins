import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { IMAGE_SERVER_URL } from '../../constants'
import { EngineInfo, PluginInfo } from '../../plugin/types'
import { Coin } from '../keymanager/coin'

export const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'litecoin',
  walletType: 'wallet:litecoin',
  currencyCode: 'LTC',
  displayName: 'Litecoin',
  denominations: [
    { name: 'LTC', multiplier: '100000000', symbol: 'Ł' },
    { name: 'mLTC', multiplier: '100000', symbol: 'mŁ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [
      'https://ltc1.trezor.io',
      'https://ltc2.trezor.io',
      'https://ltc3.trezor.io',
      'https://ltc4.trezor.io',
      'https://ltc5.trezor.io'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/litecoin/block/%s',
  addressExplorer: 'https://blockchair.com/litecoin/address/%s',
  transactionExplorer: 'https://blockchair.com/litecoin/transaction/%s',

  // Images:
  symbolImage: `${IMAGE_SERVER_URL}/litecoin-logo-solo-64.png`,
  symbolImageDarkMono: `${IMAGE_SERVER_URL}/litecoin-logo-solo-64.png`
}

export const engineInfo: EngineInfo = {
  coinType: 2,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  network: 'litecoin',
  gapLimit: 10,
  defaultFee: 50000,
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

export const coinInfo: Coin = {
  name: 'litecoin',
  segwit: true,
  coinType: 2,
  mainnetConstants: {
    messagePrefix: '\x18Litecoin Signed Message:\n',
    wif: 0xb0,
    legacyXPriv: 0x019d9cfe,
    legacyXPub: 0x019da462,
    wrappedSegwitXPriv: 0x01b26792,
    wrappedSegwitXPub: 0x01b26ef6,
    segwitXPriv: 0x04b2430c,
    segwitXPub: 0x04b24746,
    pubkeyHash: 0x30,
    scriptHash: 0x32,
    bech32: 'ltc'
  },

  legacyConstants: {
    messagePrefix: '\x18Litecoin Signed Message:\n',
    wif: 0xb0,
    legacyXPriv: 0x019d9cfe,
    legacyXPub: 0x019da462,
    wrappedSegwitXPriv: 0x01b26792,
    wrappedSegwitXPub: 0x01b26ef6,
    segwitXPriv: 0x04b2430c,
    segwitXPub: 0x04b24746,
    pubkeyHash: 0x30,
    scriptHash: 0x05,
    bech32: 'ltc'
  },

  testnetConstants: {
    messagePrefix: '\x18Litecoin Signed Message:\n',
    wif: 0xef,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    wrappedSegwitXPriv: 0x044a4e28,
    wrappedSegwitXPub: 0x044a5262,
    segwitXPriv: 0x045f18bc,
    segwitXPub: 0x045f1cf6,
    pubkeyHash: 0x6f,
    scriptHash: 0x3a,
    bech32: 'tltc'
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo, coinInfo }
