import { EdgeSpendInfo } from 'edge-core-js/types'
import { join } from 'path'

const dummyDataPath = join(__dirname, 'dummyData')

export interface SpendTests {
  [key: string]: EdgeSpendInfo
}
const Spend: SpendTests = {
  'low fee': {
    tokenId: null,
    networkFeeOption: 'low',
    metadata: {
      name: 'Transfer to College Fund',
      category: 'Transfer:Wallet:College Fund'
    },
    spendTargets: [
      {
        publicAddress: '2MutAAY6tW2HEyrhSadT1aQhP4KdCAKkC74',
        nativeAmount: '210000'
      },
      {
        publicAddress: 'tb1qzu5e2xhmh7lyfs38yq0u7xmem37ufp6tp6uh6q',
        nativeAmount: '420000'
      }
    ]
  },
  'low standard fee': {
    tokenId: null,
    networkFeeOption: 'standard',
    metadata: {
      name: 'Transfer to College Fund',
      category: 'Transfer:Wallet:College Fund'
    },
    spendTargets: [
      {
        publicAddress: '2MutAAY6tW2HEyrhSadT1aQhP4KdCAKkC74',
        nativeAmount: '17320'
      }
    ]
  },
  'middle standard fee': {
    tokenId: null,
    networkFeeOption: 'standard',
    metadata: {
      name: 'Transfer to College Fund',
      category: 'Transfer:Wallet:College Fund'
    },
    spendTargets: [
      {
        publicAddress: '2MutAAY6tW2HEyrhSadT1aQhP4KdCAKkC74',
        nativeAmount: '43350000'
      }
    ]
  },
  'high standard fee': {
    tokenId: null,
    networkFeeOption: 'standard',
    metadata: {
      name: 'Transfer to College Fund',
      category: 'Transfer:Wallet:College Fund'
    },
    spendTargets: [
      {
        publicAddress: '2MutAAY6tW2HEyrhSadT1aQhP4KdCAKkC74',
        nativeAmount: '86700000'
      },
      {
        publicAddress: 'tb1qzu5e2xhmh7lyfs38yq0u7xmem37ufp6tp6uh6q',
        nativeAmount: '420000'
      }
    ]
  },
  'high fee': {
    tokenId: null,
    networkFeeOption: 'high',
    metadata: {
      name: 'Transfer to College Fund',
      category: 'Transfer:Wallet:College Fund'
    },
    spendTargets: [
      {
        publicAddress: '2MutAAY6tW2HEyrhSadT1aQhP4KdCAKkC74',
        nativeAmount: '210000'
      },
      {
        publicAddress: 'tb1qzu5e2xhmh7lyfs38yq0u7xmem37ufp6tp6uh6q',
        nativeAmount: '420000'
      }
    ]
  },
  'custom fee': {
    tokenId: null,
    networkFeeOption: 'custom',
    customNetworkFee: { satPerByte: '1000' },
    metadata: {
      name: 'Transfer to College Fund',
      category: 'Transfer:Wallet:College Fund'
    },
    spendTargets: [
      {
        publicAddress: '2MutAAY6tW2HEyrhSadT1aQhP4KdCAKkC74',
        nativeAmount: '210000'
      },
      {
        publicAddress: 'tb1qzu5e2xhmh7lyfs38yq0u7xmem37ufp6tp6uh6q',
        nativeAmount: '420000'
      }
    ]
  }
}
const InsufficientFundsError: SpendTests = {
  'an amount over the balance': {
    tokenId: null,
    networkFeeOption: 'high',
    metadata: {
      name: 'Transfer to College Fund',
      category: 'Transfer:Wallet:College Fund'
    },
    spendTargets: [
      {
        publicAddress: '2MutAAY6tW2HEyrhSadT1aQhP4KdCAKkC74',
        nativeAmount: '2100000000'
      },
      {
        publicAddress: 'tb1qzu5e2xhmh7lyfs38yq0u7xmem37ufp6tp6uh6q',
        nativeAmount: '420000'
      }
    ]
  },
  'a really big amount': {
    tokenId: null,
    networkFeeOption: 'high',
    metadata: {
      name: 'Transfer to College Fund',
      category: 'Transfer:Wallet:College Fund'
    },
    spendTargets: [
      {
        publicAddress: '2MutAAY6tW2HEyrhSadT1aQhP4KdCAKkC74',
        nativeAmount: '9999999999999000000000'
      },
      {
        publicAddress: 'tb1qzu5e2xhmh7lyfs38yq0u7xmem37ufp6tp6uh6q',
        nativeAmount: '9999999999999000000000'
      }
    ]
  }
}
const Sweep: SpendTests = {
  'low fee': {
    spendTargets: [],
    tokenId: null,
    networkFeeOption: 'low',
    metadata: {
      name: 'Transfer to College Fund',
      category: 'Transfer:Wallet:College Fund'
    },
    privateKeys: ['cQSzMGPwF7uWP2jRcLxndSvgepeVXJ1DLVrDu7gRJS3kZDmHHXsp']
  },
  'low standard fee': {
    spendTargets: [],
    tokenId: null,
    networkFeeOption: 'low',
    metadata: {
      name: 'Transfer to College Fund',
      category: 'Transfer:Wallet:College Fund'
    },
    privateKeys: ['cQSzMGPwF7uWP2jRcLxndSvgepeVXJ1DLVrDu7gRJS3kZDmHHXsp']
  },
  'high fee': {
    spendTargets: [],
    tokenId: null,
    networkFeeOption: 'high',
    metadata: {
      name: 'Transfer to College Fund',
      category: 'Transfer:Wallet:College Fund'
    },
    privateKeys: ['cQSzMGPwF7uWP2jRcLxndSvgepeVXJ1DLVrDu7gRJS3kZDmHHXsp']
  },
  'custom fee': {
    spendTargets: [],
    tokenId: null,
    networkFeeOption: 'custom',
    customNetworkFee: { satPerByte: '1000' },
    metadata: {
      name: 'Transfer to College Fund',
      category: 'Transfer:Wallet:College Fund'
    },
    privateKeys: ['cQSzMGPwF7uWP2jRcLxndSvgepeVXJ1DLVrDu7gRJS3kZDmHHXsp']
  }
}

export default {
  dummyDataPath,
  pluginId: 'bitcointestnet',
  WALLET_TYPE: 'wallet:bitcoin-testnet',
  WALLET_FORMAT: 'bip49',
  TX_AMOUNT: 6,
  'Test Currency code': 'TESTBTC',
  key: [
    39,
    190,
    34,
    129,
    208,
    32,
    145,
    88,
    191,
    217,
    226,
    98,
    183,
    16,
    52,
    150,
    52,
    53,
    31,
    137,
    164,
    40,
    236,
    146,
    128,
    107,
    129,
    59,
    192,
    240,
    40,
    238
  ],
  xpub:
    'xpub661MyMwAqRbcF6JxG5NqmWiCbURzYtg95A5T7m6bdJ27FHDuLcVHmAg4unEMvdNi5VniUWgxxDJM5odBjUUzuSNCciED3sbfdX37NsdKTiQ',
  'invalid key name': {
    type: 'wallet:bitcoin',
    keys: { bitcoinKeyz: '12345678abcd' }
  },
  'invalid wallet type': {
    type: 'shitcoin',
    keys: { bitcoinKeyz: '12345678abcd' }
  },
  'Make Engine': {
    network: 'bitcointestnet',
    id: '1',
    userSettings: {
      enableOverrideServers: true,
      electrumServers: [['electrum.hsmiths.com', '8080']]
    }
  },
  'Sign message': {
    success: {
      message:
        'e38ee6739bf1e94c078192aaae7405bdcae28f927f1d509d2691ff212a4f0dfe',
      address: '2MwgwSSqcRaNyc6ULeHU6xkfaD57ayie1Nn',
      signature:
        '3044022055addeb86bc1a00e5d2f3e0bef0e2a35166d14364a20c2d382fa275f26908e7702206e7067d4e6aee442a0c243eb00ec952ca6fd70ea453220e51bff07fae2edc25c',
      publicKey:
        '03f3c3fd4551b057c8ab841dc960e0a90351b29fd0fdeb9bfc4279c29526886521'
    }
  },
  BlockHeight: {
    uri: 'https://api.blocktrail.com/v1/tBTC/block/latest?api_key=MY_APIKEY',
    defaultHeight: 1286739
  },
  ChangeSettings: {
    blockbookServers: [],
    enableCustomServers: false
  },
  'Address used from cache': {
    wrongFormat: ['TestErrorWithWrongAddress'],
    notInWallet: ['mnSmvy2q4dFNKQF18EBsrZrS7WEy6CieEE'],
    empty: {
      'P2SH address': '2N9DbpGaQEeLLZgPQP4gc9oKkrFHdsj5Eew'
    },
    nonEmpty: {
      'P2SH address 1': '2MwLo2ghJeXTgpDccHGcsTbdS9YVfM3K5GG',
      'P2SH address 2': '2MxRjw65NxR4DsRj2z1f5xFnKkU5uMRCsoT',
      'P2SH address 3': '2MxvxJh44wq17vhzGqFcAsuYsVmdEJKWuFV'
    }
  },
  'Add Gap Limit': {
    derived: [
      '2MvNRPakFUtKSe7ZYcyextQd3sfSEKiqUHY',
      '2MxRjw65NxR4DsRj2z1f5xFnKkU5uMRCsoT'
    ],
    future: []
  },
  Spend,
  InsufficientFundsError,
  Sweep
}
