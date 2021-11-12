import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'badcoin',
  walletType: 'wallet:badcoin',
  currencyCode: 'BAD',
  displayName: 'Badcoin',
  denominations: [
    { name: 'BAD', multiplier: '100000000', symbol: 'BAD' },
    { name: 'mBAD', multiplier: '100000', symbol: 'mBAD' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [],
    disableFetchingServers: true
  },
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://www.blockingbad.com/address/%s',
  blockExplorer: 'https://www.blockingbad.com/block/%s',
  transactionExplorer: 'https://www.blockingbad.com/tx/%s'
}

const engineInfo: EngineInfo = {
  formats: ['bip49', 'bip44', 'bip32'],
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
  name: 'badcoin',
  segwit: false,
  coinType: 324,
  mainnetConstants: {
    messagePrefix: '\x18Badcoin Signed Message:\n',
    wif: 0xb0,
    legacyXPriv: 0x06c4abc9,
    legacyXPub: 0x06c4abc8,
    pubkeyHash: 0x1c,
    scriptHash: 0x19
  },

  legacyConstants: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    wif: 0x80,
    legacyXPriv: 0x0488ade4,
    legacyXPub: 0x0488b21e,
    pubkeyHash: 0x00,
    scriptHash: 0x05
  },

  testnetConstants: {
    messagePrefix: '\x18Badcoin Signed Message:\n',
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
