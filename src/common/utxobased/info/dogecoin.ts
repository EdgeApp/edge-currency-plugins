import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { makeDogeUtxoPicker } from './utxoPickers/dogeUtxoPicker'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'dogecoin',
  walletType: 'wallet:dogecoin',
  currencyCode: 'DOGE',
  displayName: 'Dogecoin',
  denominations: [{ name: 'DOGE', multiplier: '100000000', symbol: 'Ð' }],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [
      'wss://doge1.trezor.io',
      'wss://doge2.trezor.io',
      'wss://doge3.trezor.io',
      'wss://doge4.trezor.io',
      'wss://doge5.trezor.io'
    ],
    disableFetchingServers: false
  },
  customFeeTemplate: [
    {
      type: 'nativeAmount',
      key: 'satPerByte',
      displayName: 'Satoshis Per Byte',
      displayMultiplier: '0'
    }
  ],
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://blockchair.com/dogecoin/address/%s?from=edgeapp',
  blockExplorer: 'https://blockchair.com/dogecoin/block/%s?from=edgeapp',
  transactionExplorer:
    'https://blockchair.com/dogecoin/transaction/%s?from=edgeapp'
}

const engineInfo: EngineInfo = {
  formats: ['bip44', 'bip32'],
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 10000,
  simpleFeeSettings: {
    highFee: '526316',
    lowFee: '526316',
    standardFeeLow: '526316',
    standardFeeHigh: '526316',
    standardFeeLowAmount: '2000000000',
    standardFeeHighAmount: '98100000000'
  }
}

export const coinInfo: CoinInfo = {
  name: 'dogecoin',
  segwit: false,
  coinType: 3,
  utxoPicker: makeDogeUtxoPicker(),
  mainnetConstants: {
    messagePrefix: '\x18Dogecoin Signed Message:\n',
    wif: 0x9e,
    legacyXPriv: 0x02fac398,
    legacyXPub: 0x02facafd,
    pubkeyHash: 0x1e,
    scriptHash: 0x16
  },

  testnetConstants: {
    messagePrefix: '\x18Dogecoin Signed Message:\n',
    wif: 0xef,
    legacyXPriv: 0x04358394,
    legacyXPub: 0x043587cf,
    pubkeyHash: 0x6f,
    scriptHash: 0xc4
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
