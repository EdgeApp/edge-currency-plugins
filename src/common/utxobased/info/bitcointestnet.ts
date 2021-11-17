import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { IMAGE_SERVER_URL } from '../../constants'
import {
  CoinInfo,
  EngineInfo,
  NetworkEnum,
  PluginInfo
} from '../../plugin/types'

export const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'bitcointestnet',
  walletType: 'wallet:bitcointestnet',
  currencyCode: 'TBTC',
  displayName: 'Bitcoin Testnet',
  denominations: [
    { name: 'TBTC', multiplier: '100000000', symbol: '₿' },
    { name: 'mTBTC', multiplier: '100000', symbol: 'm₿' },
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
  forks: ['bitcoincash', 'bitcoingold'],
  network: 'bitcointestnet',
  networkType: NetworkEnum.Testnet,
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

export const coinInfo: CoinInfo = {
  name: 'bitcointestnet',
  segwit: true,
  coinType: 1,

  mainnetConstants: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0x80,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    wrappedSegwitXPriv: 0x049d7878,
    wrappedSegwitXPub: 0x049d7cb2,
    segwitXPriv: 0x04b2430c,
    segwitXPub: 0x04b24746,
    pubkeyHash: 0x00,
    scriptHash: 0x05,
    bech32: 'bc'
  },

  testnetConstants: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
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
