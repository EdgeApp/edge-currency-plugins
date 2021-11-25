import * as bitcoin from 'altcoin-js'
import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { IMAGE_SERVER_URL } from '../../constants'
import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { scriptTemplates } from './scriptTemplates/bitcoincashScriptTemplates'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'bitcoincashtestnet',
  walletType: 'wallet:bitcoincashtestnet',
  currencyCode: 'TBCH',
  displayName: 'Bitcoin Cash',
  denominations: [
    { name: 'TBCH', multiplier: '100000000', symbol: '₿' },
    { name: 'mTBCH', multiplier: '100000', symbol: 'm₿' },
    { name: 'cash', multiplier: '100', symbol: 'ƀ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin-cash/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin-cash/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin-cash/transaction/%s',
  xpubExplorer: 'https://blockchair.com/bitcoin-cash/xpub/%s',

  // Images:
  symbolImage: `${IMAGE_SERVER_URL}/bitcoincash-logo-solo-64.png`,
  symbolImageDarkMono: `${IMAGE_SERVER_URL}/bitcoincash-logo-solo-64.png`
}

const engineInfo: EngineInfo = {
  formats: ['bip44', 'bip32'],
  forks: ['bitcoincashsv'],
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
  },
  scriptTemplates
}

export const coinInfo: CoinInfo = {
  name: 'bitcoincashtestnet',
  segwit: false,
  sighash: bitcoin.Psbt.BCH_SIGHASH_ALL,
  coinType: 1,

  mainnetConstants: {
    messagePrefix: ['\x18Bitcoin Signed Message:\n'],
    wif: [0xef],
    legacyXPriv: [0x04358394],
    legacyXPub: [0x043587cf],
    pubkeyHash: [0x6f],
    scriptHash: [0xc4],
    cashaddr: ['bchtest']
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo, coinInfo }
