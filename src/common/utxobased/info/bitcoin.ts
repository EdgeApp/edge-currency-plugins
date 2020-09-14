import { EngineCoinType, EngineCurrencyInfo } from '../../plugin/CurrencyEngine'
import { imageServerUrl } from './constants'

export const info: EngineCurrencyInfo = {
  coinType: EngineCoinType.UTXO,
  network: 'bitcoin',
  currencyCode: 'BTC',
  gapLimit: 25,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '150',
    lowFee: '20',
    standardFeeLow: '50',
    standardFeeHigh: '100',
    standardFeeLowAmount: '173200',
    standardFeeHighAmount: '8670000'
  },

  // Basic currency information:
  displayName: 'Bitcoin',
  pluginId: 'bitcoin',
  denominations: [
    { name: 'BTC', multiplier: '100000000', symbol: '₿' },
    { name: 'mBTC', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' },
    { name: 'sats', multiplier: '1', symbol: 's' }
  ],
  walletType: 'wallet:bitcoin',

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    electrumServers: [
      'electrum://electrum-bc-az-eusa.airbitz.co:50001',
      'electrum://electrum.hsmiths.com:8080',
      'electrum://node.arihanc.com:50001',
      'electrum://electrum.petrkr.net:50001',
      'electrum://electrum2.everynothing.net:50001',
      'electrum://currentlane.lovebitco.in:50001',
      'electrum://electrum.hsmiths.com:50001',
      'electrum://electrumx.westeurope.cloudapp.azure.com:50001'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin/transaction/%s',

  // Images:
  symbolImage: `${imageServerUrl}/bitcoin-logo-solo-64.png`,
  symbolImageDarkMono: `${imageServerUrl}/bitcoin-logo-solo-64.png`
}
