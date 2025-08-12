import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

const currencyInfo: EdgeCurrencyInfo = {
  assetDisplayName: 'Bitcoin',
  canReplaceByFee: true,
  chainDisplayName: 'Bitcoin',
  currencyCode: 'BTC',
  customFeeTemplate: utxoCustomFeeTemplate,
  memoOptions: utxoMemoOptions,
  pluginId: 'bitcoin',
  walletType: 'wallet:bitcoin',

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin/transaction/%s',

  denominations: [
    { name: 'BTC', multiplier: '100000000', symbol: '₿' },
    { name: 'mBTC', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' },
    { name: 'sats', multiplier: '1', symbol: 's' }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: [
      'wss://btc-wusa1.edge.app',
      'wss://btc-eu1.edge.app',
      'wss://btc1.trezor.io',
      'wss://btc2.trezor.io',
      'wss://btc3.trezor.io',
      'wss://btc4.trezor.io',
      'wss://btc5.trezor.io',
      'wss://btcbook.nownodes.io/wss/%{nowNodesApiKey}'
    ],
    enableCustomServers: false
  },
  displayName: 'Bitcoin',
  metaTokens: []
}

const engineInfo: EngineInfo = {
  serverConfigs: [
    {
      type: 'blockbook-nownode',
      uris: ['https://btc-wusa1.edge.app', 'https://btc-eu1.edge.app']
    },
    {
      type: 'blockbook-nownode',
      uris: ['https://btcbook.nownodes.io']
    }
  ],
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  forks: ['bitcoincash', 'bitcoingold'],
  gapLimit: 25,
  feeUpdateInterval: 60000,
  mempoolSpaceFeeInfoServer: 'https://mempool.space/api/v1/fees/recommended',
  defaultFeeInfo: {
    lowFeeFudgeFactor: undefined,
    standardFeeLowFudgeFactor: undefined,
    standardFeeHighFudgeFactor: undefined,
    highFeeFudgeFactor: undefined,

    highFee: '150',
    lowFee: '20',
    standardFeeLow: '50',
    standardFeeHigh: '100',
    standardFeeLowAmount: '173200',
    standardFeeHighAmount: '8670000',
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 27460.65)
  }
}

export const coinInfo: CoinInfo = {
  name: 'bitcoin',
  segwit: true,
  coinType: 0,

  prefixes: {
    messagePrefix: ['\x18Bitcoin Signed Message:\n'],
    wif: [0x80],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    wrappedSegwitXPriv: [0x049d7878],
    wrappedSegwitXPub: [0x049d7cb2],
    segwitXPriv: [0x04b2430c],
    segwitXPub: [0x04b24746],
    pubkeyHash: [0x00],
    scriptHash: [0x05],
    bech32: ['bc']
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
