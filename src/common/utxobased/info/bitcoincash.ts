import { Psbt } from 'altcoin-js'
import { asCodec, asString } from 'cleaners'
import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'
import { scriptTemplates } from './scriptTemplates/bitcoincashScriptTemplates'

const currencyInfo: EdgeCurrencyInfo = {
  currencyCode: 'BCH',
  customFeeTemplate: utxoCustomFeeTemplate,
  displayName: 'Bitcoin Cash',
  memoOptions: utxoMemoOptions,
  pluginId: 'bitcoincash',
  walletType: 'wallet:bitcoincash',

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin-cash/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin-cash/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin-cash/transaction/%s',

  denominations: [
    { name: 'BCH', multiplier: '100000000', symbol: '₿' },
    { name: 'mBCH', multiplier: '100000', symbol: 'm₿' },
    { name: 'cash', multiplier: '100', symbol: 'ƀ' }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: [
      'wss://bch1.trezor.io',
      'wss://bch2.trezor.io',
      'wss://bch3.trezor.io',
      'wss://bch4.trezor.io',
      'wss://bch5.trezor.io',
      'wss://bch-wusa1.edge.app',
      'wss://bchbook.nownodes.io/wss/%{nowNodesApiKey}'
    ],
    enableCustomServers: false
  },
  metaTokens: []
}

const engineInfo: EngineInfo = {
  serverConfigs: [
    {
      type: 'blockbook-nownode',
      uris: ['https://bch-wusa1.edge.app']
    },
    {
      type: 'blockbook-nownode',
      uris: ['https://bchbook.nownodes.io']
    }
  ],
  formats: ['bip44', 'bip32'],
  forks: [], // 'bitcoinsv' is currently disabled, so not included in the forks
  gapLimit: 10,
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
    standardFeeHighAmount: '65000000',
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 212.86)
  },
  scriptTemplates,
  asBlockbookAddress: asCodec(
    raw => {
      return asString(raw).split(':')[1]
    },
    address => `bitcoincash:${address}`
  )
}

export const coinInfo: CoinInfo = {
  name: 'bitcoincash',
  segwit: false,
  sighash: Psbt.BCH_SIGHASH_ALL,
  coinType: 145,

  prefixes: {
    messagePrefix: ['\x18Bitcoin Signed Message:\n'],
    wif: [0x80],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    pubkeyHash: [0x00],
    scriptHash: [0x05],
    cashaddr: ['bitcoincash']
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo, coinInfo }
