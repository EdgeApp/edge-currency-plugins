import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

const currencyInfo: EdgeCurrencyInfo = {
  assetDisplayName: 'Qtum',
  chainDisplayName: 'Qtum',
  currencyCode: 'QTUM',
  customFeeTemplate: utxoCustomFeeTemplate,
  memoOptions: utxoMemoOptions,
  pluginId: 'qtum',
  walletType: 'wallet:qtum',

  // Explorers:
  addressExplorer: 'https://explorer.qtum.org/address/%s',
  blockExplorer: 'https://explorer.qtum.org/block/%s',
  transactionExplorer: 'https://explorer.qtum.org/tx/%s',

  denominations: [{ name: 'QTUM', multiplier: '100000000', symbol: 'Q' }],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: [
      'wss://qtum-wusa1.edge.app',
      'wss://blockv3.qtum.info',
      'wss://qtum.atomicwallet.io'
    ],
    enableCustomServers: false
  },
  displayName: 'Qtum',
  metaTokens: []
}

const engineInfo: EngineInfo = {
  serverConfigs: [
    {
      type: 'blockbook-nownode',
      uris: ['https://qtum-wusa1.edge.app']
    }
  ],
  formats: ['bip44', 'bip32'],
  gapLimit: 10,
  feeUpdateInterval: 60000,
  defaultFeeInfo: {
    lowFeeFudgeFactor: undefined,
    standardFeeLowFudgeFactor: undefined,
    standardFeeHighFudgeFactor: undefined,
    highFeeFudgeFactor: undefined,

    highFee: '1000',
    lowFee: '400',
    standardFeeLow: '450',
    standardFeeHigh: '700',
    standardFeeLowAmount: '20000000',
    standardFeeHighAmount: '981000000',
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 2.13)
  }
}

export const coinInfo: CoinInfo = {
  name: 'qtum',
  segwit: false,
  coinType: 2301,
  prefixes: {
    messagePrefix: ['\x18Bitcoin Signed Message:\n'],
    wif: [0x80],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    pubkeyHash: [0x3a],
    scriptHash: [0x32]
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
