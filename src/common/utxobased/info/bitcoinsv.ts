import * as bitcoin from 'altcoin-js'
import { asCodec, asString } from 'cleaners'
import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { IMAGE_SERVER_URL } from '../../constants'
import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import {
  addressToScriptPubkey,
  AddressTypeEnum,
  scriptPubkeyToAddress
} from '../keymanager/keymanager'

const currencyInfo: EdgeCurrencyInfo = {
  pluginId: 'bitcoinsv',
  walletType: 'wallet:bitcoinsv',
  currencyCode: 'BSV',
  displayName: 'Bitcoin SV',
  denominations: [
    { name: 'BSV', multiplier: '100000000', symbol: '₿' },
    { name: 'mBSV', multiplier: '100000', symbol: 'm₿' },
    { name: 'cash', multiplier: '100', symbol: 'ƀ' }
  ],

  // Configuration options:
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    blockbookServers: ['wss://blockbook.siftbitcoin.com:9146'],
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
  metaTokens: [],

  // Explorers:
  blockExplorer: 'https://whatsonchain.com/block/%s',
  addressExplorer: 'https://whatsonchain.com/address/%s',
  transactionExplorer: 'https://whatsonchain.com/tx/%s',

  // Images:
  symbolImage: `${IMAGE_SERVER_URL}/bitcoinsv-logo-solo-64.png`,
  symbolImageDarkMono: `${IMAGE_SERVER_URL}/bitcoinsv-logo-solo-64.png`
}

const engineInfo: EngineInfo = {
  formats: ['bip44', 'bip32'],
  uriPrefix: 'bitcoin',
  gapLimit: 10,
  defaultFee: 10000,
  feeUpdateInterval: 60000,
  simpleFeeSettings: {
    highFee: '20',
    lowFee: '3',
    standardFeeLow: '5',
    standardFeeHigh: '10',
    standardFeeLowAmount: '1000000',
    standardFeeHighAmount: '65000000'
  },
  /*
  This is to support cashaddr and 1-addresses coming from the network.
  We always convert to a 1-address for internal use.
  We send 1-address to the network because all servers should support legacy 
  address (this is the uncleaner).
  */
  asBlockbookAddress: asCodec(
    raw => {
      const networkAddress = asString(raw)
      try {
        // cashaddr
        const address = networkAddress.replace('bitcoincash:', '')
        const scriptPubkey = addressToScriptPubkey({
          address,
          coin: 'bitcoincash'
        })
        return scriptPubkeyToAddress({
          scriptPubkey,
          coin: 'bitcoinsv',
          addressType: AddressTypeEnum.p2pkh
        }).address
      } catch (err) {
        // 1address
        return networkAddress
      }
    },
    address => address
  )
}

export const coinInfo: CoinInfo = {
  name: 'bitcoinsv',
  segwit: false,
  sighash: bitcoin.Psbt.BCH_SIGHASH_ALL,
  coinType: 236,

  prefixes: {
    messagePrefix: ['\x18Bitcoin Signed Message:\n'],
    wif: [0x80],
    legacyXPriv: [0x0488ade4],
    legacyXPub: [0x0488b21e],
    pubkeyHash: [0x00],
    scriptHash: [0x05]
  }
}

export const info: PluginInfo = { currencyInfo, engineInfo, coinInfo }
