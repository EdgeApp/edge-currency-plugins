import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

const currencyInfo: EdgeCurrencyInfo = {
  assetDisplayName: 'Ravencoin',
  chainDisplayName: 'Ravencoin',
  currencyCode: 'RVN',
  customFeeTemplate: utxoCustomFeeTemplate,
  memoOptions: utxoMemoOptions,
  pluginId: 'ravencoin',
  walletType: 'wallet:ravencoin',

  // Explorers:
  addressExplorer: 'https://rvn.cryptoscope.io/address/?address=%s',
  blockExplorer: 'https://rvn.cryptoscope.io/block/?blockheight=%s',
  transactionExplorer: 'https://rvn.cryptoscope.io/tx/?txid=%s',

  denominations: [{ name: 'RVN', multiplier: '100000000', symbol: 'R' }],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: ['wss://blockbook.ravencoin.org'],
    enableCustomServers: false
  },
  displayName: 'Ravencoin',
  metaTokens: []
}

const engineInfo: EngineInfo = {
  formats: ['bip44', 'bip32'],
  gapLimit: 10,
  feeUpdateInterval: 60000,
  defaultFeeInfo: {
    lowFeeFudgeFactor: undefined,
    standardFeeLowFudgeFactor: undefined,
    standardFeeHighFudgeFactor: undefined,
    highFeeFudgeFactor: undefined,

    highFee: '150',
    lowFee: '20',
    standardFeeLow: '50',
    standardFeeHigh: '100',
    standardFeeLowAmount: '173200',
    standardFeeHighAmount: '8670000',
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 0.01419)
  }
}

export const coinInfo: CoinInfo = {
  name: 'ravencoin',
  segwit: false,
  coinType: 175,
  prefixes: {
    messagePrefix: ['\x18Bitcoin Signed Message:\n'],
    wif: [0x80],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    pubkeyHash: [0x3c],
    scriptHash: [0x7a]
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
