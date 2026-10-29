import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

const currencyInfo: EdgeCurrencyInfo = {
  assetDisplayName: 'eCash Betanet',
  canReplaceByFee: true,
  chainDisplayName: 'eCash Betanet',
  currencyCode: 'BETAECX',
  customFeeTemplate: utxoCustomFeeTemplate,
  memoOptions: utxoMemoOptions,
  pluginId: 'ecashbitcoinbetanet',
  walletType: 'wallet:ecashbitcoinbetanet',

  // Explorers:
  blockExplorer: 'https://explorer.beta.ecash.ninja/block/%s',
  addressExplorer: 'https://explorer.beta.ecash.ninja/address/%s',
  transactionExplorer: 'https://explorer.beta.ecash.ninja/tx/%s',

  denominations: [
    { name: 'BETAECX', multiplier: '100000000' },
    { name: 'sats', multiplier: '1', symbol: 's' }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: ['wss://blockbook.beta.ecash.ninja/websocket'],
    enableCustomServers: false
  },
  displayName: 'eCash Betanet',
  metaTokens: []
}

const engineInfo: EngineInfo = {
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  // Matches Bitcoin, so wallets split from Bitcoin find every pre-fork address:
  gapLimit: 25,
  feeUpdateInterval: 60000,
  mempoolSpaceFeeInfoServer:
    'https://explorer.beta.ecash.ninja/api/v1/fees/precise',
  defaultFeeInfo: {
    lowFeeFudgeFactor: undefined,
    standardFeeLowFudgeFactor: undefined,
    standardFeeHighFudgeFactor: undefined,
    highFeeFudgeFactor: undefined,

    highFee: '10',
    lowFee: '1',
    standardFeeLow: '2',
    standardFeeHigh: '5',
    standardFeeLowAmount: '173200',
    standardFeeHighAmount: '8670000',
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 100)
  }
}

export const coinInfo: CoinInfo = {
  name: 'ecashbitcoinbetanet',
  segwit: true,
  coinType: 0,
  // LOCKTIME_THRESHOLD - 1, final only on eCash betanet:
  lockTime: 499999999,

  prefixes: {
    messagePrefix: ['\x18Bitcoin Signed Message:\n'],
    wif: [0x80],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    wrappedSegwitXPriv: [0x049d7878],
    wrappedSegwitXPub: [0x049d7cb2],
    segwitXPriv: [0x04b2430c],
    segwitXPub: [0x04b24746],
    pubkeyHash: [0x00],
    scriptHash: [0x05],
    bech32: ['bc']
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
