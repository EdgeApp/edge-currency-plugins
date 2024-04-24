import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { IMAGE_SERVER_URL } from '../../constants'
import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

export const currencyInfo: EdgeCurrencyInfo = {
  canReplaceByFee: true,
  currencyCode: 'TESTBTC',
  customFeeTemplate: utxoCustomFeeTemplate,
  displayName: 'Bitcoin Testnet',
  memoOptions: utxoMemoOptions,
  pluginId: 'bitcointestnet',
  walletType: 'wallet:bitcointestnet',

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin/testnet/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin/testnet/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin/testnet/transaction/%s',

  // Images:
  symbolImage: `${IMAGE_SERVER_URL}/bitcoin-logo-solo-64.png`,
  symbolImageDarkMono: `${IMAGE_SERVER_URL}/bitcoin-logo-solo-64.png`,

  denominations: [
    { name: 'TESTBTC', multiplier: '100000000', symbol: '₿' },
    { name: 'mTESTBTC', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' },
    { name: 'sats', multiplier: '1', symbol: 's' }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: ['wss://tbtc1.trezor.io', 'wss://tbtc2.trezor.io'],
    enableCustomServers: false
  },
  metaTokens: []
}

export const engineInfo: EngineInfo = {
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  forks: ['bitcoincash', 'bitcoingold'],
  gapLimit: 25,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  mempoolSpaceFeeInfoServer: 'https://mempool.space/api/v1/fees/recommended',
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
    standardFeeHighAmount: '8670000'
  }
}

export const coinInfo: CoinInfo = {
  name: 'bitcointestnet',
  segwit: true,
  coinType: 1,

  prefixes: {
    messagePrefix: ['\x18Bitcoin Signed Message:\n'],
    wif: [0xef],
    legacyXPriv: [0x04358394],
    legacyXPub: [0x043587cf],
    wrappedSegwitXPriv: [0x044a4e28],
    wrappedSegwitXPub: [0x044a5262],
    segwitXPriv: [0x045f18bc],
    segwitXPub: [0x045f1cf6],
    pubkeyHash: [0x6f],
    scriptHash: [0xc4],
    bech32: ['tb']
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo, coinInfo }
