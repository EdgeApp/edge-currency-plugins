import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

const currencyInfo: EdgeCurrencyInfo = {
  assetDisplayName: 'PIVX',
  chainDisplayName: 'PIVX',
  currencyCode: 'PIVX',
  customFeeTemplate: utxoCustomFeeTemplate,
  memoOptions: utxoMemoOptions,
  pluginId: 'pivx',
  walletType: 'wallet:pivx',

  // Explorers:
  addressExplorer: 'https://zkbitcoin.com/address/%s',
  blockExplorer: 'https://zkbitcoin.com/block/%s',
  transactionExplorer: 'https://zkbitcoin.com/tx/%s',

  denominations: [
    {
      name: 'PIVX',
      multiplier: '100000000',
      symbol: 'Ᵽ'
    }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: ['wss://pivx-wusa1.edge.app', 'wss://zkbitcoin.com'],
    enableCustomServers: false
  },
  displayName: 'PIVX',
  metaTokens: []
}

const engineInfo: EngineInfo = {
  serverConfigs: [
    {
      type: 'blockbook-nownode',
      uris: ['https://pivx-wusa1.edge.app']
    },
    {
      type: 'blockbook-nownode',
      uris: ['https://pivxbook.nownodes.io']
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

    highFee: '200',
    lowFee: '50',
    standardFeeLow: '100',
    standardFeeHigh: '150',
    standardFeeLowAmount: '10000000',
    standardFeeHighAmount: '100000000',
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 0.6)
  }
}

export const coinInfo: CoinInfo = {
  name: 'pivx',
  segwit: false,
  coinType: 119,
  prefixes: {
    /*
    [Prefix reference](https://github.com/PIVX-Project/PIVX/blob/b89a9fc04e9e31bb3fd009df0506c957a00ad536/src/chainparams.cpp#L329)
    */
    messagePrefix: ['PIVX Signed Message:\n'],
    wif: [0xd4],
    legacyXPriv: [0x0221312b],
    legacyXPub: [0x022d2533],
    pubkeyHash: [0x1e],
    scriptHash: [0x0d]
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
