import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

const currencyInfo: EdgeCurrencyInfo = {
  assetDisplayName: 'Badcoin',
  chainDisplayName: 'Badcoin',
  currencyCode: 'BAD',
  customFeeTemplate: utxoCustomFeeTemplate,
  memoOptions: utxoMemoOptions,
  pluginId: 'badcoin',
  walletType: 'wallet:badcoin',

  // Explorers:
  addressExplorer: 'https://www.blockingbad.com/address/%s',
  blockExplorer: 'https://www.blockingbad.com/block/%s',
  transactionExplorer: 'https://www.blockingbad.com/tx/%s',

  denominations: [
    { name: 'BAD', multiplier: '100000000', symbol: 'BAD' },
    { name: 'mBAD', multiplier: '100000', symbol: 'mBAD' }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: [],
    enableCustomServers: false
  },
  displayName: 'Badcoin',
  metaTokens: []
}

const engineInfo: EngineInfo = {
  formats: ['bip49', 'bip44', 'bip32'],
  gapLimit: 10,
  feeUpdateInterval: 60000,
  defaultFeeInfo: {
    lowFeeFudgeFactor: undefined,
    standardFeeLowFudgeFactor: undefined,
    standardFeeHighFudgeFactor: undefined,
    highFeeFudgeFactor: undefined,

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
  prefixes: {
    messagePrefix: [
      '\x18Badcoin Signed Message:\n',
      '\x18Bitcoin Signed Message:\n'
    ],
    wif: [0xb0, 0x80],
    legacyXPriv: [0x06c4abc9, 0x0488ade4],
    legacyXPub: [0x06c4abc8, 0x0488b21e],
    pubkeyHash: [0x1c, 0x00],
    scriptHash: [0x19, 0x05]
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
