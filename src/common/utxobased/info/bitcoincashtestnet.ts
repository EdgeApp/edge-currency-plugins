import { Psbt } from 'altcoin-js'
import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'
import { scriptTemplates } from './scriptTemplates/bitcoincashScriptTemplates'

const currencyInfo: EdgeCurrencyInfo = {
  currencyCode: 'TBCH',
  displayName: 'Bitcoin Cash',
  memoOptions: utxoMemoOptions,
  customFeeTemplate: utxoCustomFeeTemplate,
  pluginId: 'bitcoincashtestnet',
  walletType: 'wallet:bitcoincashtestnet',

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin-cash/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin-cash/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin-cash/transaction/%s',
  xpubExplorer: 'https://blockchair.com/bitcoin-cash/xpub/%s',

  denominations: [
    { name: 'TBCH', multiplier: '100000000', symbol: '₿' },
    { name: 'mTBCH', multiplier: '100000', symbol: 'm₿' },
    { name: 'cash', multiplier: '100', symbol: 'ƀ' }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: [],
    enableCustomServers: false
  },
  metaTokens: []
}

const engineInfo: EngineInfo = {
  formats: ['bip44', 'bip32'],
  forks: ['bitcoinsv'],
  gapLimit: 10,
  defaultFee: 10000,
  feeUpdateInterval: 60000,
  defaultFeeInfo: {
    lowFeeFudgeFactor: undefined,
    standardFeeLowFudgeFactor: undefined,
    standardFeeHighFudgeFactor: undefined,
    highFeeFudgeFactor: undefined,

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
  sighash: Psbt.BCH_SIGHASH_ALL,
  coinType: 1,

  prefixes: {
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
