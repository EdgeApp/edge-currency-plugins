import { Psbt } from 'altcoin-js'
import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { memoInfo } from './commonInfo'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'bitcoingold',
  walletType: 'wallet:bitcoingold',
  currencyCode: 'BTG',
  displayName: 'Bitcoin Gold',
  denominations: [
    { name: 'BTG', multiplier: '100000000', symbol: '₿' },
    { name: 'mBTG', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: [
      'wss://btg1.trezor.io',
      'wss://btg2.trezor.io',
      'wss://btg3.trezor.io',
      'wss://btg4.trezor.io',
      'wss://btg5.trezor.io'
    ],
    enableCustomServers: false
  },
  customFeeTemplate: [
    {
      type: 'nativeAmount',
      key: 'satPerByte',
      displayName: 'Satoshis Per Byte',
      displayMultiplier: '0'
    }
  ],
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
  name: 'bitcoingold',
  segwit: true,
  sighash: Psbt.BTG_SIGHASH_ALL,
  coinType: 156,

  prefixes: {
    messagePrefix: ['\x18Bitcoin Gold Signed Message:\n'],
    wif: [0x80],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    wrappedSegwitXPriv: [0x049d7878],
    wrappedSegwitXPub: [0x049d7cb2],
    segwitXPriv: [0x04b2430c],
    segwitXPub: [0x04b24746],
    pubkeyHash: [0x26],
    scriptHash: [0x17],
    bech32: ['btg']
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
