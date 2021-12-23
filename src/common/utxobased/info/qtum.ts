import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { serverListFields } from '../../plugin/utils'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'qtum',
  walletType: 'wallet:qtum',
  currencyCode: 'QTUM',
  displayName: 'Qtum',
  denominations: [{ name: 'QTUM', multiplier: '100000000', symbol: 'Q' }],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    ...serverListFields([]),
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
  addressExplorer: 'https://explorer.qtum.org/address/%s',
  blockExplorer: 'https://explorer.qtum.org/block/%s',
  transactionExplorer: 'https://explorer.qtum.org/tx/%s'
}

const engineInfo: EngineInfo = {
  formats: ['bip44', 'bip32'],
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  simpleFeeSettings: {
    highFee: '1000',
    lowFee: '400',
    standardFeeLow: '450',
    standardFeeHigh: '700',
    standardFeeLowAmount: '20000000',
    standardFeeHighAmount: '981000000'
  }
}

export const coinInfo: CoinInfo = {
  name: 'qtum',
  segwit: false,
  coinType: 2301,
  prefixes: {
    messagePrefix: ['\x18Bitcoin Signed Message:\n'],
    wif: [0x80],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    pubkeyHash: [0x3a],
    scriptHash: [0x32]
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
