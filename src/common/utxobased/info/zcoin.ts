import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

export const currencyInfo: EdgeCurrencyInfo = {
  assetDisplayName: 'Firo',
  chainDisplayName: 'Firo',
  currencyCode: 'FIRO',
  customFeeTemplate: utxoCustomFeeTemplate,
  memoOptions: utxoMemoOptions,
  pluginId: 'zcoin',
  walletType: 'wallet:zcoin',

  // Explorers:
  addressExplorer: 'https://insight.zcoin.io/address/%s',
  blockExplorer: 'https://insight.zcoin.io/block/%s',
  transactionExplorer: 'https://insight.zcoin.io/tx/%s',

  denominations: [
    { name: 'FIRO', multiplier: '100000000', symbol: 'ƒ' },
    { name: 'mFIRO', multiplier: '100000', symbol: 'mƒ' }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: [
      // 'wss://blockbook.firo.org',
      'wss://firo-wusa1.edge.app'
      // 'wss://firo.nownodes.io/wss/%{nowNodesApiKey}'
    ],
    enableCustomServers: false
  },
  displayName: 'Firo',
  metaTokens: []
}

export const engineInfo: EngineInfo = {
  serverConfigs: [
    {
      type: 'blockbook-nownode',
      uris: ['https://firo-wusa1.edge.app']
    },
    {
      type: 'blockbook-nownode',
      uris: ['https://firobook.nownodes.io']
    }
  ],
  formats: ['bip44', 'bip32'],
  uriPrefix: 'firo',
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
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 1.39)
  }
}

export const coinInfo: CoinInfo = {
  name: 'zcoin',
  segwit: false,
  coinType: 136,
  prefixes: {
    messagePrefix: ['\x18Zcoin Signed Message:\n'],
    wif: [0xd2],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    pubkeyHash: [0x52],
    scriptHash: [0x7]
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo, coinInfo }
