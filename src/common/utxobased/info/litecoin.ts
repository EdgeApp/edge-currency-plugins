import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { IMAGE_SERVER_URL } from '../../constants'
import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'

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
  blockExplorer: 'https://blockchair.com/litecoin/block/%s',
  addressExplorer: 'https://blockchair.com/litecoin/address/%s',
  transactionExplorer: 'https://blockchair.com/litecoin/transaction/%s',

  // Images:
  symbolImage: `${IMAGE_SERVER_URL}/litecoin-logo-solo-64.png`,
  symbolImageDarkMono: `${IMAGE_SERVER_URL}/litecoin-logo-solo-64.png`
}

export const engineInfo: EngineInfo = {
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  gapLimit: 10,
  defaultFee: 50000,
  feeUpdateInterval: 60000,
  simpleFeeSettings: {
    highFee: '300',
    lowFee: '100',
    standardFeeLow: '150',
    standardFeeHigh: '200',
    standardFeeLowAmount: '20000000',
    standardFeeHighAmount: '981000000'
  }
}

export const coinInfo: CoinInfo = {
  name: 'litecoin',
  segwit: true,
  coinType: 2,
  mainnetConstants: {
    messagePrefix: ['\x18Litecoin Signed Message:\n'],
    wif: [0xb0],
    legacyXPriv: [0x019d9cfe],
    legacyXPub: [0x019da462],
    wrappedSegwitXPriv: [0x01b26792],
    wrappedSegwitXPub: [0x01b26ef6],
    segwitXPriv: [0x04b2430c],
    segwitXPub: [0x04b24746],
    pubkeyHash: [0x30],
    scriptHash: [0x32, 0x05],
    bech32: ['ltc']
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo, coinInfo }
