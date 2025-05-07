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

const currencyInfo: EdgeCurrencyInfo = {
  assetDisplayName: 'eCash',
  chainDisplayName: 'eCash',
  currencyCode: 'XEC',
  customFeeTemplate: utxoCustomFeeTemplate,
  memoOptions: utxoMemoOptions,
  pluginId: 'ecash',
  walletType: 'wallet:ecash',

  // Explorers:
  blockExplorer: 'https://blockchair.com/ecash/block/%s',
  addressExplorer: 'https://explorer.e.cash/address/ecash:%s',
  transactionExplorer: 'https://explorer.e.cash/tx/%s',

  denominations: [
    { name: 'XEC', multiplier: '100', symbol: 'e' },
    { name: 'sats', multiplier: '1', symbol: 's' }
  ],
  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: ['wss://blockbook.fabien.cash/websocket'],
    enableCustomServers: false
  },
  displayName: 'eCash',
  metaTokens: []
}

const engineInfo: EngineInfo = {
  serverConfigs: [
    {
      type: 'blockbook-nownode',
      uris: ['https://xec-blockbook.nownodes.io']
    }
  ],
  formats: ['bip44', 'bip32'],
  gapLimit: 10,
  feeUpdateInterval: 60000,
  defaultFeeInfo: {
    lowFeeFudgeFactor: '1',
    standardFeeLowFudgeFactor: '1',
    standardFeeHighFudgeFactor: '1',
    highFeeFudgeFactor: '1',

    highFee: '20',
    lowFee: '1',
    standardFeeLow: '2',
    standardFeeHigh: '20',
    standardFeeLowAmount: '400000000',
    standardFeeHighAmount: '650000000',
    maximumFeeRate: maximumFeeRateCalculator(currencyInfo, 0.00003)
  },
  asBlockbookAddress: asCodec(
    raw => {
      return asString(raw).split(':')[1]
    },
    address => `ecash:${address}`
  )
}

export const coinInfo: CoinInfo = {
  name: 'ecash',
  segwit: false,
  sighash: Psbt.BCH_SIGHASH_ALL,
  coinType: 899,

  prefixes: {
    messagePrefix: ['\x18Bitcoin Signed Message::\n'],
    wif: [0x80],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    pubkeyHash: [0x00],
    scriptHash: [0x05],
    cashaddr: ['ecash']
  }
}

export const info: PluginInfo = {
  currencyInfo,
  engineInfo,
  coinInfo
}
