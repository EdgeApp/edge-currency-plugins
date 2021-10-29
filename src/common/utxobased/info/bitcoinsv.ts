import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { IMAGE_SERVER_URL } from '../../constants'
import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'bitcoinsv',
  walletType: 'wallet:bitcoinsv',
  currencyCode: 'BSV',
  displayName: 'Bitcoin SV',
  denominations: [
    { name: 'BSV', multiplier: '100000000', symbol: '₿' },
    { name: 'mBSV', multiplier: '100000', symbol: 'm₿' },
    { name: 'cash', multiplier: '100', symbol: 'ƀ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [],
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
  blockExplorer: 'https://blockchair.com/bitcoin-sv/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin-sv/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin-sv/transaction/%s',

  // Images:
  symbolImage: `${IMAGE_SERVER_URL}/bitcoinsv-logo-solo-64.png`,
  symbolImageDarkMono: `${IMAGE_SERVER_URL}/bitcoinsv-logo-solo-64.png`
}

const engineInfo: EngineInfo = {
  formats: ['bip44', 'bip32'],
  uriPrefix: 'bitcoin',
  gapLimit: 10,
  defaultFee: 10000,
  feeUpdateInterval: 60000,
  simpleFeeSettings: {
    highFee: '20',
    lowFee: '3',
    standardFeeLow: '5',
    standardFeeHigh: '10',
    standardFeeLowAmount: '1000000',
    standardFeeHighAmount: '65000000'
  }
}

export const coinInfo: CoinInfo = {
  name: 'bitcoinsv',
  segwit: false,
  coinType: 236,

  mainnetConstants: {
    messagePrefix: ['\x18Bitcoin Signed Message:\n'],
    wif: [0x80],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    pubkeyHash: [0x00],
    scriptHash: [0x05],
    cashaddr: ['', 'bitcoincash']
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo, coinInfo }
