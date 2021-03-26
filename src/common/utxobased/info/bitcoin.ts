import { EngineCurrencyInfo, EngineCurrencyType } from '../../plugin/types'
import { imageServerUrl } from './constants'

export const info: EngineCurrencyInfo = {
  currencyType: EngineCurrencyType.UTXO,
  coinType: 0,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  network: 'bitcoin',
  pluginId: 'bitcoin',
  walletType: 'wallet:bitcoin',
  currencyCode: 'BTC',
  displayName: 'Bitcoin',
  gapLimit: 25,
  defaultFee: 1000,
  feeUpdateInterval: 60000,
  earnComFeeInfoServer: 'https://Bitcoinfees.Earn.com/api/v1/fees/list',
  mempoolSpaceFeeInfoServer: 'https://mempool.space/api/v1/fees/recommended',
  customFeeSettings: ['satPerByte'],
  simpleFeeSettings: {
    highFee: '150',
    lowFee: '20',
    standardFeeLow: '50',
    standardFeeHigh: '100',
    standardFeeLowAmount: '173200',
    standardFeeHighAmount: '8670000'
  },
  denominations: [
    { name: 'BTC', multiplier: '100000000', symbol: '₿' },
    { name: 'mBTC', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' },
    { name: 'sats', multiplier: '1', symbol: 's' }
  ],

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
