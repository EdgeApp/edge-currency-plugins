import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

export const currencyInfo: EdgeCurrencyInfo = {
  currencyCode: 'FTC',
  customFeeTemplate: utxoCustomFeeTemplate,
  displayName: 'Feathercoin',
  memoOptions: utxoMemoOptions,
  pluginId: 'feathercoin',
  walletType: 'wallet:feathercoin',

  // Explorers:
  addressExplorer: 'https://fsight.chain.tips/address/%s',
  blockExplorer: 'https://fsight.chain.tips/block/%s',
  transactionExplorer: 'https://fsight.chain.tips/tx/%s',

  denominations: [
    { name: 'FTC', multiplier: '100000000', symbol: 'F' },
    { name: 'mFTC', multiplier: '100000', symbol: 'mF' }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: ['wss://blockbook.feathercoin.com'],
    enableCustomServers: false
  },
  metaTokens: []
}

export const engineInfo: EngineInfo = {
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  defaultFeeInfo: {
    lowFeeFudgeFactor: undefined,
    standardFeeLowFudgeFactor: undefined,
    standardFeeHighFudgeFactor: undefined,
    highFeeFudgeFactor: undefined,

    highFee: '1200',
    lowFee: '400',
    standardFeeLow: '600',
    standardFeeHigh: '800',
    standardFeeLowAmount: '2000000000',
    standardFeeHighAmount: '98100000000',
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 0.002275)
  }
}

export const coinInfo: CoinInfo = {
  name: 'feathercoin',
  segwit: true,
  coinType: 8,
  prefixes: {
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
