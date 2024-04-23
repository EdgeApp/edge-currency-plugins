import { Psbt } from 'altcoin-js'
import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { memoInfo } from './commonInfo'

const currencyInfo: EdgeCurrencyInfo = {
  currencyCode: 'TBTG',
  displayName: 'Bitcoin Gold',
  pluginId: 'bitcoingoldtestnet',
  walletType: 'wallet:bitcoingoldtestnet',

  denominations: [
    { name: 'TBTG', multiplier: '100000000', symbol: '₿' },
    { name: 'mTBTG', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: [],
    enableCustomServers: false
  },
  ...memoInfo,

  // Explorers:
  addressExplorer: 'https://explorer.bitcoingold.org/insight/address/%s',
  blockExplorer: 'https://explorer.bitcoingold.org/insight/block/%s',
  transactionExplorer: 'https://explorer.bitcoingold.org/insight/tx/%s',

  // Deprecated:
  metaTokens: []
}

const engineInfo: EngineInfo = {
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  defaultFeeInfo: {
    lowFeeFudgeFactor: undefined,
    standardFeeLowFudgeFactor: undefined,
    standardFeeHighFudgeFactor: undefined,
    highFeeFudgeFactor: undefined,

    highFee: '200',
    lowFee: '10',
    standardFeeLow: '15',
    standardFeeHigh: '140',
    standardFeeLowAmount: '17320',
    standardFeeHighAmount: '86700000'
  }
}

export const coinInfo: CoinInfo = {
  name: 'bitcoingoldtestnet',
  segwit: true,
  sighash: Psbt.BTG_SIGHASH_ALL,
  coinType: 1,

  prefixes: {
    messagePrefix: ['\x18Bitcoin Gold Signed Message:\n'],
    wif: [0xef],
    legacyXPriv: [0x04358394],
    legacyXPub: [0x043587cf],
    wrappedSegwitXPriv: [0x044a4e28],
    wrappedSegwitXPub: [0x044a5262],
    segwitXPriv: [0x045f18bc],
    segwitXPub: [0x045f1cf6],
    pubkeyHash: [0x6f],
    scriptHash: [0xc4],
    bech32: ['btg']
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
