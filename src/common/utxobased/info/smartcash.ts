import { crypto } from 'altcoin-js'
import * as base58smart from 'bs58smartcheck'
import { EdgeCurrencyInfo } from 'edge-core-js/types'
import * as wifsmart from 'wif-smart'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'smartcash',
  walletType: 'wallet:smartcash',
  currencyCode: 'SMART',
  displayName: 'SmartCash',
  denominations: [
    { name: 'SMART', multiplier: '100000000', symbol: 'S' },
    { name: 'mSMART', multiplier: '100000', symbol: 'mS' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [],
    disableFetchingServers: true
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
  addressExplorer: 'https://insight.smartcash.cc/address/%s',
  blockExplorer: 'https://insight.smartcash.cc/block/%s',
  transactionExplorer: 'https://insight.smartcash.cc/tx/%s'
}

const engineInfo: EngineInfo = {
  formats: ['bip44', 'bip32'],
  gapLimit: 10,
  defaultFee: 100000,
  feeUpdateInterval: 60000,
  simpleFeeSettings: {
    highFee: '1500',
    lowFee: '200',
    standardFeeLow: '500',
    standardFeeHigh: '1000',
    standardFeeLowAmount: '1732000',
    standardFeeHighAmount: '86700000'
  }
}

export const coinInfo: CoinInfo = {
  name: 'smartcash',
  segwit: false,
  coinType: 224,
  sighashFunction: crypto.sha256,
  bs58DecodeFunc: base58smart.decode,
  bs58EncodeFunc: base58smart.encode,
  wifEncodeFunc: wifsmart.encode,
  mainnetConstants: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0xbf,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    pubkeyHash: 0x3f,
    scriptHash: 0x12
  },

  testnetConstants: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
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
