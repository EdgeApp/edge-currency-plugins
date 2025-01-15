import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

const currencyInfo: EdgeCurrencyInfo = {
  assetDisplayName: 'Vertcoin',
  chainDisplayName: 'Vertcoin',
  currencyCode: 'VTC',
  customFeeTemplate: utxoCustomFeeTemplate,
  memoOptions: utxoMemoOptions,
  pluginId: 'vertcoin',
  walletType: 'wallet:vertcoin',

  // Explorers:
  addressExplorer: 'https://insight.vertcoin.org/address/%s',
  blockExplorer: 'https://insight.vertcoin.org/block/%s',
  transactionExplorer: 'https://insight.vertcoin.org/tx/%s',

  denominations: [
    { name: 'VTC', multiplier: '100000000', symbol: 'V' },
    { name: 'mVTC', multiplier: '100000', symbol: 'mV' }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: [
      'wss://vtc1.trezor.io',
      'wss://vtc2.trezor.io',
      'wss://vtc3.trezor.io',
      'wss://vtc4.trezor.io',
      'wss://vtc5.trezor.io'
    ],
    enableCustomServers: false
  },
  displayName: 'Vertcoin',
  metaTokens: []
}

const engineInfo: EngineInfo = {
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  forks: [],
  gapLimit: 10,
  feeUpdateInterval: 60000,
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
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 0.04662)
  }
}

export const coinInfo: CoinInfo = {
  name: 'vertcoin',
  segwit: true,
  coinType: 28,
  prefixes: {
    messagePrefix: ['\x18Bitcoin Signed Message:\n'],
    wif: [0x80],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    wrappedSegwitXPriv: [0x0488ade4],
    wrappedSegwitXPub: [0x0488b21e],
    segwitXPriv: [0x0488ade4],
    segwitXPub: [0x0488b21e],
    pubkeyHash: [0x47],
    scriptHash: [0x05],
    bech32: ['vtc']
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
