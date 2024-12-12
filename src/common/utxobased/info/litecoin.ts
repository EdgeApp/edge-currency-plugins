import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

export const currencyInfo: EdgeCurrencyInfo = {
  canReplaceByFee: false,
  currencyCode: 'LTC',
  customFeeTemplate: utxoCustomFeeTemplate,
  displayName: 'Litecoin',
  memoOptions: utxoMemoOptions,
  pluginId: 'litecoin',
  walletType: 'wallet:litecoin',

  // Explorers:
  blockExplorer: 'https://blockchair.com/litecoin/block/%s',
  addressExplorer: 'https://blockchair.com/litecoin/address/%s',
  transactionExplorer: 'https://blockchair.com/litecoin/transaction/%s',

  denominations: [
    { name: 'LTC', multiplier: '100000000', symbol: 'Ł' },
    { name: 'mLTC', multiplier: '100000', symbol: 'mŁ' }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: [
      'wss://ltc1.trezor.io',
      'wss://ltc2.trezor.io',
      'wss://ltc3.trezor.io',
      'wss://ltc4.trezor.io',
      'wss://ltc5.trezor.io',
      'wss://ltc-wusa1.edge.app',
      'wss://ltcbook.nownodes.io/wss/%{nowNodesApiKey}'
    ],
    enableCustomServers: false
  },
  metaTokens: []
}

export const engineInfo: EngineInfo = {
  serverConfigs: [
    {
      type: 'blockbook-nownode',
      uris: ['https://ltc-wusa1.edge.app']
    },
    {
      type: 'blockbook-nownode',
      uris: ['https://ltcbook.nownodes.io']
    }
  ],
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  forks: ['bitcoin'],
  gapLimit: 10,
  feeUpdateInterval: 60000,
  defaultFeeInfo: {
    lowFeeFudgeFactor: undefined,
    standardFeeLowFudgeFactor: undefined,
    standardFeeHighFudgeFactor: undefined,
    highFeeFudgeFactor: undefined,

    highFee: '300',
    lowFee: '100',
    standardFeeLow: '150',
    standardFeeHigh: '200',
    standardFeeLowAmount: '20000000',
    standardFeeHighAmount: '981000000',
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 63.64)
  }
}

export const coinInfo: CoinInfo = {
  name: 'litecoin',
  segwit: true,
  coinType: 2,
  prefixes: {
    messagePrefix: ['\x18Litecoin Signed Message:\n'],
    wif: [0xb0],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
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
