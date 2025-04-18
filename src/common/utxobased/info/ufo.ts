import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

const currencyInfo: EdgeCurrencyInfo = {
  assetDisplayName: 'UFO',
  chainDisplayName: 'UFO',
  currencyCode: 'UFO',
  customFeeTemplate: utxoCustomFeeTemplate,
  memoOptions: utxoMemoOptions,
  pluginId: 'ufo',
  walletType: 'wallet:ufo',

  // Explorers:
  addressExplorer: 'https://explorer.ufobject.com/address/%s',
  blockExplorer: 'https://explorer.ufobject.com/block/%s',
  transactionExplorer: 'https://explorer.ufobject.com/tx/%s',

  denominations: [
    { name: 'UFO', multiplier: '100000000', symbol: 'Ʉ' },
    { name: 'kUFO', multiplier: '100000000000', symbol: 'kɄ' }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: ['wss://blockbook.ufobject.com'],
    enableCustomServers: false
  },
  displayName: 'UFO',
  metaTokens: []
}

const engineInfo: EngineInfo = {
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  gapLimit: 10,
  feeUpdateInterval: 60000,
  defaultFeeInfo: {
    lowFeeFudgeFactor: undefined,
    standardFeeLowFudgeFactor: undefined,
    standardFeeHighFudgeFactor: undefined,
    highFeeFudgeFactor: undefined,

    highFee: '2250',
    lowFee: '1000',
    standardFeeLow: '1100',
    standardFeeHigh: '2000',
    standardFeeLowAmount: '51282051282051',
    standardFeeHighAmount: '5128205128205100',
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 0.000137)
  }
}

export const coinInfo: CoinInfo = {
  name: 'uniformfiscalobject',
  segwit: true,
  coinType: 202,
  prefixes: {
    messagePrefix: ['\x18Bitcoin Signed Message:\n'],
    wif: [0x9b],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    wrappedSegwitXPriv: [0x049d7878],
    wrappedSegwitXPub: [0x049d7cb2],
    segwitXPriv: [0x04b2430c],
    segwitXPub: [0x04b24746],
    pubkeyHash: [0x1b],
    scriptHash: [0x44, 0x05],
    bech32: ['uf']
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
