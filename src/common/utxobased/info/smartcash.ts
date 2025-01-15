import { crypto } from 'altcoin-js'
import * as base58smart from 'bs58smartcheck'
import { EdgeCurrencyInfo } from 'edge-core-js/types'
import * as wifsmart from 'wif-smart'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

const currencyInfo: EdgeCurrencyInfo = {
  assetDisplayName: 'SmartCash',
  chainDisplayName: 'SmartCash',
  currencyCode: 'SMART',
  customFeeTemplate: utxoCustomFeeTemplate,
  memoOptions: utxoMemoOptions,
  pluginId: 'smartcash',
  walletType: 'wallet:smartcash',

  // Explorers:
  addressExplorer: 'https://insight.smartcash.cc/address/%s',
  blockExplorer: 'https://insight.smartcash.cc/block/%s',
  transactionExplorer: 'https://insight.smartcash.cc/tx/%s',

  denominations: [
    { name: 'SMART', multiplier: '100000000', symbol: 'S' },
    { name: 'mSMART', multiplier: '100000', symbol: 'mS' }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: [],
    enableCustomServers: false
  },
  displayName: 'SmartCash',
  metaTokens: []
}

const engineInfo: EngineInfo = {
  formats: ['bip44', 'bip32'],
  gapLimit: 10,
  feeUpdateInterval: 60000,
  defaultFeeInfo: {
    lowFeeFudgeFactor: undefined,
    standardFeeLowFudgeFactor: undefined,
    standardFeeHighFudgeFactor: undefined,
    highFeeFudgeFactor: undefined,

    highFee: '1500',
    lowFee: '200',
    standardFeeLow: '500',
    standardFeeHigh: '1000',
    standardFeeLowAmount: '1732000',
    standardFeeHighAmount: '86700000',
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 0.0002171)
  }
}

export const coinInfo: CoinInfo = {
  name: 'smartcash',
  segwit: false,
  coinType: 224,
  sighashFunction: crypto.sha256,
  txHashFunction: crypto.sha256,
  bs58DecodeFunc: base58smart.decode,
  bs58EncodeFunc: base58smart.encode,
  wifEncodeFunc: wifsmart.encode,
  prefixes: {
    messagePrefix: ['\x18Bitcoin Signed Message:\n'],
    wif: [0xbf],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    pubkeyHash: [0x3f],
    scriptHash: [0x12]
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
