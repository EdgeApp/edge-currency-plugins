import { EdgeCurrencyInfo } from 'edge-core-js/types'

import { CoinInfo, EngineInfo, PluginInfo } from '../../plugin/types'
import {
  legacyMemoInfo,
  utxoCustomFeeTemplate,
  utxoMemoOptions
} from './commonInfo'

/**
 * eCash (ECX), the ecash.com hard fork of Bitcoin by Layer Two Labs, which
 * activates drivechains (BIP300/BIP301) and credits every Bitcoin address 1:1
 * at the fork block. It is unrelated to the Bitcoin ABC eCash (XEC) chain that
 * this repo ships as the `ecash` plugin, and the two only share a brand name.
 *
 * The chain is pre-launch, so the values below track the `drynet4` dry run
 * network and the `drynet4` branch of github.com/ecash-com/bitcoin. Launch
 * parameters are published at https://drivechain.info/dev.txt and
 * https://ecash.com. Anything the fork has not published yet is left empty or
 * omitted here rather than guessed.
 */

const currencyInfo: EdgeCurrencyInfo = {
  // Layer Two Labs disambiguates its chain from XEC as "eCash.com", the same
  // label their Blockbook coin config uses:
  assetDisplayName: 'eCash.com',
  canReplaceByFee: true,
  chainDisplayName: 'eCash.com',
  currencyCode: 'ECX',
  customFeeTemplate: utxoCustomFeeTemplate,
  memoOptions: utxoMemoOptions,
  pluginId: 'ecashcom',
  walletType: 'wallet:ecashcom',

  // Explorers:
  // ECX has no explorer. Every public service still runs against the drynet
  // dry-run networks, including the one Layer Two Labs' own wallet ships
  // (`explorer.drynet3.drivechain.dev` in its NetworkRegistry), and no
  // ecash.com explorer host resolves. An empty string is the "no explorer"
  // signal the app already understands, so the explorer rows stay hidden until
  // a real host is published.
  addressExplorer: '',
  transactionExplorer: '',

  denominations: [
    // No symbol: XEC uses "e" and ECX has not published one.
    { name: 'ECX', multiplier: '100000000' },
    { name: 'sats', multiplier: '1', symbol: 's' }
  ],

  // Deprecated:
  ...legacyMemoInfo,
  defaultSettings: {
    customFeeSettings: ['satPerByte'],
    // No public ECX Blockbook endpoint exists. The fork's own stack is
    // Electrum and Esplora, so a Blockbook has to be deployed from Layer Two
    // Labs' coin config (github.com/ecash-com/blockbook, branch `ecash-com`)
    // before a wallet can sync:
    blockbookServers: [],
    enableCustomServers: false
  },
  displayName: 'eCash.com',
  metaTokens: []
}

const engineInfo: EngineInfo = {
  formats: ['bip49', 'bip84', 'bip44', 'bip32'],
  gapLimit: 25,
  feeUpdateInterval: 60000,
  defaultFeeInfo: {
    lowFeeFudgeFactor: undefined,
    standardFeeLowFudgeFactor: undefined,
    standardFeeHighFudgeFactor: undefined,
    highFeeFudgeFactor: undefined,

    // The fork inherits Bitcoin's block size, supply and divisibility, so
    // Bitcoin's fee levels carry over as the starting point. `maximumFeeRate`
    // is omitted: it is derived from a USD price, ECX does not trade yet, and
    // a made-up price yields a cap that guards nothing. Leaving it unset keeps
    // the signing library's own default until a real price exists.
    highFee: '150',
    lowFee: '20',
    standardFeeLow: '50',
    standardFeeHigh: '100',
    standardFeeLowAmount: '173200',
    standardFeeHighAmount: '8670000'
  }
}

export const coinInfo: CoinInfo = {
  name: 'ecashcom',
  segwit: true,

  // ECX has no SLIP-44 index of its own and reuses Bitcoin's key space. This
  // is what lets a wallet split from Bitcoin: the forked coins sit on the
  // Bitcoin derivation paths, so any other coin type would derive addresses
  // that hold nothing.
  coinType: 0,

  // A transaction with `nLockTime` of `LOCKTIME_THRESHOLD - 1` is final to
  // eCash nodes, while Bitcoin reads it as a block height roughly 500 million
  // blocks away and rejects it as non-final. That asymmetry is the fork's
  // opt-in replay protection, and it only holds while the input sequence
  // numbers stay below `0xffffffff`.
  replayProtectionLocktime: 499999999,

  // Keys and addresses are byte for byte identical to Bitcoin:
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
