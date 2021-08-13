import { IMAGE_SERVER_URL } from '../../constants'
import { EngineCurrencyInfo, EngineCurrencyType } from '../../plugin/types'
import { NetworkEnum } from '../keymanager/bitcoincashUtils/cashAddress'

export const info: EngineCurrencyInfo = {
  currencyType: EngineCurrencyType.UTXO,
  coinType: 1,
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  forks: ['bitcoincash', 'bitcoingold'],
  network: 'bitcoin',
  pluginId: 'bitcointestnet',
  walletType: 'wallet:bitcointestnet',
  currencyCode: 'TBTC',
  displayName: 'Bitcoin Testnet',
  networkType: NetworkEnum.Testnet,
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
    { name: 'TBTC', multiplier: '100000000', symbol: '₿' },
    { name: 'mTBTC', multiplier: '100000', symbol: 'm₿' },
    { name: 'bits', multiplier: '100', symbol: 'ƀ' },
    { name: 'sats', multiplier: '1', symbol: 's' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockBookServers: [
      'wss://tbtc1.trezor.io/websocket',
      'wss://tbtc2.trezor.io/websocket'
    ],
    disableFetchingServers: false
  },
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://blockchair.com/bitcoin/testnet/block/%s',
  addressExplorer: 'https://blockchair.com/bitcoin/testnet/address/%s',
  transactionExplorer: 'https://blockchair.com/bitcoin/testnet/transaction/%s',

  // Images:
  symbolImage: `${IMAGE_SERVER_URL}/bitcoin-logo-solo-64.png`,
  symbolImageDarkMono: `${IMAGE_SERVER_URL}/bitcoin-logo-solo-64.png`
}
