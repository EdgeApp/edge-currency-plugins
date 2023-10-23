import { crypto } from 'altcoin-js'
import * as bip32grs from 'bip32grs'
import * as base58grs from 'bs58grscheck'
import { EdgeCurrencyInfo } from 'edge-core-js/types'
import * as wifgrs from 'wifgrs'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import { memoInfo } from './commonInfo'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'groestlcoin',
  walletType: 'wallet:groestlcoin',
  currencyCode: 'GRS',
  displayName: 'Groestlcoin',
  denominations: [
    { name: 'GRS', multiplier: '100000000', symbol: 'G' },
    { name: 'mGRS', multiplier: '100000', symbol: 'mG' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: ['wss://blockbook.groestlcoin.org'],
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
  ...memoInfo,

  // Explorers:
  addressExplorer:
    'https://blockchair.com/groestlcoin/address/%s?from=edgeapp?from=edgeapp',
  blockExplorer: 'https://blockchair.com/groestlcoin/block/%s?from=edgeapp',
  transactionExplorer:
    'https://blockchair.com/groestlcoin/transaction/%s?from=edgeapp',

  // Deprecated:
  metaTokens: []
}

const engineInfo: EngineInfo = {
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  gapLimit: 10,
  defaultFee: 100000,
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
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 0.4705)
  }
}

export const coinInfo: CoinInfo = {
  name: 'groestlcoin',
  segwit: true,
  coinType: 17,
  sighashFunction: crypto.sha256,
  txHashFunction: crypto.sha256,
  bs58DecodeFunc: base58grs.decode,
  bs58EncodeFunc: base58grs.encode,
  wifEncodeFunc: wifgrs.encode,
  bip32FromBase58Func: bip32grs.fromBase58,
  bip32FromSeedFunc: bip32grs.fromSeed,
  prefixes: {
    messagePrefix: ['\x1cGroestlCoin Signed Message:\n'],
    wif: [0x80],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    wrappedSegwitXPriv: [0x049d7878],
    wrappedSegwitXPub: [0x049d7cb2],
    segwitXPriv: [0x04b2430c],
    segwitXPub: [0x04b24746],
    pubkeyHash: [0x24],
    scriptHash: [0x05],
    bech32: ['grs']
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
