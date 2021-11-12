import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'eboost',
  walletType: 'wallet:eboost',
  currencyCode: 'EBST',
  displayName: 'eBoost',
  denominations: [
    { name: 'EBST', multiplier: '100000000', symbol: 'EBST' },
    { name: 'mEBST', multiplier: '100000', symbol: 'mEBST' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://www.blockexperts.com/ebst/address/%s',
  blockExplorer: 'https://www.blockexperts.com/ebst/hash/%s',
  transactionExplorer: 'https://www.blockexperts.com/ebst/tx/%s'
}

const engineInfo: EngineInfo = {
  formats: ['bip44', 'bip32'],
  network: 'eboost',
  gapLimit: 10,
  defaultFee: 500000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '300',
    lowFee: '100',
    standardFeeLow: '150',
    standardFeeHigh: '200',
    standardFeeLowAmount: '20000000',
    standardFeeHighAmount: '981000000'
  }
}

export const coinInfo: CoinInfo = {
  name: 'eboost',
  segwit: false,
  coinType: 324,
  mainnetConstants: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0xdc,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    pubkeyHash: 0x5c,
    scriptHash: 0x05
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
