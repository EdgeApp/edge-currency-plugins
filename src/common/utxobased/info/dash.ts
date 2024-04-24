import { asBoolean, asMaybe, asObject, asOptional } from 'cleaners'
import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import { maximumFeeRateCalculator } from '../../plugin/util/maximumFeeRateCalculator'
import { IProcessorTransaction } from '../db/types'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

const currencyInfo: EdgeCurrencyInfo = {
  currencyCode: 'DASH',
  customFeeTemplate: utxoCustomFeeTemplate,
  displayName: 'Dash',
  memoOptions: utxoMemoOptions,
  pluginId: 'dash',
  walletType: 'wallet:dash',

  // Explorers:
  addressExplorer: 'https://blockchair.com/dash/address/%s?from=edgeapp',
  blockExplorer: 'https://blockchair.com/dash/block/%s?from=edgeapp',
  transactionExplorer:
    'https://blockchair.com/dash/transaction/%s?from=edgeapp',

  denominations: [
    { name: 'DASH', multiplier: '100000000', symbol: 'Ð' },
    { name: 'mDASH', multiplier: '100000', symbol: 'mÐ' }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: [
      'wss://dash1.trezor.io',
      'wss://dash2.trezor.io',
      'wss://dash3.trezor.io',
      'wss://dash4.trezor.io',
      'wss://dash5.trezor.io'
    ],
    enableCustomServers: false
  },
  metaTokens: []
}

const engineInfo: EngineInfo = {
  serverConfigs: [
    {
      type: 'blockbook-nownode',
      uris: ['dashbook.nownodes.io']
    }
  ],
  formats: ['bip44', 'bip32'],
  gapLimit: 10,
  defaultFee: 10000,
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
    standardFeeHighAmount: '981000000',
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 25.8)
  },
  txSpecificHandling: (
    tx: IProcessorTransaction,
    txSpecific: unknown
  ): IProcessorTransaction => {
    const asDashTransactionSpecific = asObject({
      instantlock: asOptional(asBoolean)
    })
    const cleanedTxSpecific = asMaybe(asDashTransactionSpecific)(txSpecific)

    if (cleanedTxSpecific?.instantlock === true) {
      tx.confirmations = 'confirmed'
    }

    return tx
  }
}

export const coinInfo: CoinInfo = {
  name: 'dash',
  segwit: false,
  coinType: 5,
  prefixes: {
    messagePrefix: ['unused'],
    wif: [0xcc],
    legacyXPriv: [0x02fe52f8],
    legacyXPub: [0x02fe52cc],
    pubkeyHash: [0x4c],
    scriptHash: [0x10]
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
