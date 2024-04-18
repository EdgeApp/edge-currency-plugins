import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'
import { makeDogeUtxoPicker } from './utxoPickers/dogeUtxoPicker'

const currencyInfo: EdgeCurrencyInfo = {
  currencyCode: 'DOGE',
  customFeeTemplate: utxoCustomFeeTemplate,
  displayName: 'Dogecoin',
  memoOptions: utxoMemoOptions,
  pluginId: 'dogecoin',
  walletType: 'wallet:dogecoin',

  // Explorers:
  addressExplorer: 'https://blockchair.com/dogecoin/address/%s?from=edgeapp',
  blockExplorer: 'https://blockchair.com/dogecoin/block/%s?from=edgeapp',
  transactionExplorer:
    'https://blockchair.com/dogecoin/transaction/%s?from=edgeapp',

  denominations: [{ name: 'DOGE', multiplier: '100000000', symbol: 'Ð' }],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: [
      'wss://doge1.trezor.io',
      'wss://doge2.trezor.io',
      'wss://doge3.trezor.io',
      'wss://doge4.trezor.io',
      'wss://doge5.trezor.io'
    ],
    enableCustomServers: false
  },
  metaTokens: []
}

const engineInfo: EngineInfo = {
  serverConfigs: [
    {
      type: 'blockbook-nownode',
      uris: ['https://dogebook.nownodes.io']
    }
  ],
  formats: ['bip44', 'bip32'],
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 10000,
  defaultFeeInfo: {
    lowFeeFudgeFactor: undefined,
    standardFeeLowFudgeFactor: undefined,
    standardFeeHighFudgeFactor: undefined,
    highFeeFudgeFactor: undefined,

    highFee: '526316',
    lowFee: '526316',
    standardFeeLow: '526316',
    standardFeeHigh: '526316',
    standardFeeLowAmount: '2000000000',
    standardFeeHighAmount: '98100000000',
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 0.05938)
  }
}

export const coinInfo: CoinInfo = {
  name: 'dogecoin',
  segwit: false,
  coinType: 3,
  utxoPicker: makeDogeUtxoPicker(),
  prefixes: {
    messagePrefix: ['\x18Dogecoin Signed Message:\n'],
    wif: [0x9e],
    legacyXPriv: [0x02fac398],
    legacyXPub: [0x02facafd],
    pubkeyHash: [0x1e],
    scriptHash: [0x16]
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
