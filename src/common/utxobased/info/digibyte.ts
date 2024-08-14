import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

const currencyInfo: EdgeCurrencyInfo = {
  currencyCode: 'DGB',
  customFeeTemplate: utxoCustomFeeTemplate,
  displayName: 'DigiByte',
  memoOptions: utxoMemoOptions,
  pluginId: 'digibyte',
  walletType: 'wallet:digibyte',

  // Explorers:
  addressExplorer: 'https://digiexplorer.info/address/%s',
  blockExplorer: 'https://digiexplorer.info/block/%s',
  transactionExplorer: 'https://digiexplorer.info/tx/%s',

  denominations: [
    { name: 'DGB', multiplier: '100000000', symbol: 'Ɗ' },
    { name: 'mDGB', multiplier: '100000', symbol: 'mƊ' }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: [
      'wss://dgb1.trezor.io',
      'wss://dgb2.trezor.io',
      'wss://dgbbook.nownodes.io/wss/%{nowNodesApiKey}'
    ],
    enableCustomServers: false
  },
  metaTokens: []
}

const engineInfo: EngineInfo = {
  serverConfigs: [
    {
      type: 'blockbook-nownode',
      uris: ['https://dgbbook.nownodes.io']
    }
  ],
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
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 0.006176)
  }
}

export const coinInfo: CoinInfo = {
  name: 'digibyte',
  segwit: true,
  coinType: 20,
  prefixes: {
    messagePrefix: ['\x18Digibyte Signed Message:\n'],
    wif: [0x80, 0x9e],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    wrappedSegwitXPriv: [0x049d7878],
    wrappedSegwitXPub: [0x049d7cb2],
    segwitXPriv: [0x04b2430c],
    segwitXPub: [0x04b24746],
    pubkeyHash: [0x1e],
    scriptHash: [0x3f, 0x05],
    bech32: ['dgb']
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
