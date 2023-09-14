import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { IMAGE_SERVER_URL } from '../../constants'
import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'

export const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'zcoin',
  walletType: 'wallet:zcoin',
  displayName: 'Firo',
  currencyCode: 'FIRO',
  denominations: [
    { name: 'FIRO', multiplier: '100000000', symbol: 'ƒ' },
    { name: 'mFIRO', multiplier: '100000', symbol: 'mƒ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: ['wss://blockbook.firo.org'],
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
  metaTokens: [],

  // Explorers:
  addressExplorer: 'https://insight.zcoin.io/address/%s',
  blockExplorer: 'https://insight.zcoin.io/block/%s',
  transactionExplorer: 'https://insight.zcoin.io/tx/%s',

  // Images:
  symbolImage: `${IMAGE_SERVER_URL}/zcoin-logo-solo-64.png`,
  symbolImageDarkMono: `${IMAGE_SERVER_URL}/zcoin-logo-solo-64.png`
}

export const engineInfo: EngineInfo = {
  formats: ['bip44', 'bip32'],
  uriPrefix: 'firo',
  gapLimit: 10,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  simpleFeeSettings: {
    lowFeeFudgeFactor: undefined,
    standardFeeLowFudgeFactor: undefined,
    standardFeeHighFudgeFactor: undefined,
    highFeeFudgeFactor: undefined,

    highFee: '150',
    lowFee: '20',
    standardFeeLow: '50',
    standardFeeHigh: '100',
    standardFeeLowAmount: '173200',
    standardFeeHighAmount: '8670000'
  }
}

export const coinInfo: CoinInfo = {
  name: 'zcoin',
  segwit: false,
  coinType: 136,
  prefixes: {
    messagePrefix: ['\x18Zcoin Signed Message:\n'],
    wif: [0xd2],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    pubkeyHash: [0x52],
    scriptHash: [0x7]
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo, coinInfo }
