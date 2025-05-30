import { airbitzSeeds, FixtureType, key, mnemonics } from '../common'

export const ecash: FixtureType = {
  pluginId: 'ecash',
  WALLET_TYPE: 'wallet:ecash',
  WALLET_FORMAT: 'bip44',
  'Test Currency code': 'XEC',
  key,
  xpub:
    'xpub6BrtJ1DTaX6hhhGgKiZ4M4LyGzxUBdQmQw6HW7e53x44C9BhiM5wJk5D6h8BJH1suQN9YHei2A9Jr4E4hDBCszKU4xdUZC3dZu1YP2TnW7q',
  'invalid key name': {
    id: 'unknown',
    type: 'wallet:ecash',
    keys: {
      ecashKeyz: '12345678abcd',
      format: 'bip44'
    }
  },
  'invalid wallet type': {
    id: 'unknown',
    type: 'shitcoin',
    keys: { ecashKeyz: '12345678abcd' }
  },
  importKey: {
    validKeys: [...mnemonics],
    invalidKeys: [
      ...airbitzSeeds.map(seed => seed.slice(1)),
      ...mnemonics.map(mnemonic => mnemonic.split(' ').slice(1).join(' ')),
      'bunch of garbly gook !@#$%^&*()'
    ],
    unsupportedKeys: airbitzSeeds
  },
  parseUri: {
    'address only': [
      'ecash:qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna',
      {
        publicAddress: 'qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna',
        metadata: {}
      }
    ],
    'address only2': [
      'ecash:qrxcfwvkxumlnq28we8e9v0hjes45nw34gjjtvmlsw',
      {
        publicAddress: 'qrxcfwvkxumlnq28we8e9v0hjes45nw34gjjtvmlsw',
        metadata: {}
      }
    ],
    'uri address': [
      'ecash:qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna',
      {
        publicAddress: 'qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna',
        metadata: {}
      }
    ],
    'uri address with amount': [
      'ecash:qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna?amount=12345678.9',
      {
        publicAddress: 'qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna',
        metadata: {},
        nativeAmount: '1234567890',
        currencyCode: 'XEC'
      }
    ],
    'uri address with amount & label': [
      'ecash:qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna?amount=12345678.9&label=Johnny%20eCash',
      {
        publicAddress: 'qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna',
        metadata: {
          name: 'Johnny eCash'
        },
        nativeAmount: '1234567890',
        currencyCode: 'XEC'
      }
    ],
    'uri address with amount, label & message': [
      'ecash:qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna?amount=12345678.9&label=Johnny%20eCash&message=Hello%20World,%20I%20miss%20you%20!',
      {
        publicAddress: 'qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna',
        metadata: {
          name: 'Johnny eCash',
          notes: 'Hello World, I miss you !'
        },
        nativeAmount: '1234567890',
        currencyCode: 'XEC'
      }
    ]
  },
  encodeUri: {
    'address only': [
      { publicAddress: 'qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna' },
      'qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna'
    ],
    // Test cashaddr prefix removal - address only (should strip prefix and return same as non-prefixed)
    'cashaddr prefixed address only': [
      { publicAddress: 'ecash:qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna' },
      'qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna'
    ],
    // Test cashaddr prefix removal - with amount (should strip prefix and return same as non-prefixed)
    'cashaddr prefixed address with amount': [
      {
        publicAddress: 'ecash:qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna',
        nativeAmount: '123456780'
      },
      'ecash:qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna?amount=1234567.8'
    ],
    // Test cashaddr prefix removal - with amount and metadata (should strip prefix and return same as non-prefixed)
    'cashaddr prefixed address with amount and metadata': [
      {
        publicAddress: 'ecash:qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna',
        nativeAmount: '123456780',
        currencyCode: 'XEC',
        metadata: {
          name: 'Johnny eCash',
          notes: 'Hello World, I miss you !'
        }
      },
      'ecash:qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna?amount=1234567.8&label=Johnny%20eCash&message=Hello%20World,%20I%20miss%20you%20!'
    ],
    'address & amount': [
      {
        publicAddress: 'qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna',
        nativeAmount: '123456780'
      },
      'ecash:qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna?amount=1234567.8'
    ],
    'address, amount, and label': [
      {
        publicAddress: 'qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna',
        nativeAmount: '123456780',
        currencyCode: 'XEC',
        metadata: {
          name: 'Johnny eCash'
        }
      },
      'ecash:qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna?amount=1234567.8&label=Johnny%20eCash'
    ],
    'address, amount, label, & message': [
      {
        publicAddress: 'qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna',
        nativeAmount: '123456780',
        currencyCode: 'XEC',
        metadata: {
          name: 'Johnny eCash',
          notes: 'Hello World, I miss you !'
        }
      },
      'ecash:qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna?amount=1234567.8&label=Johnny%20eCash&message=Hello%20World,%20I%20miss%20you%20!'
    ],
    'invalid currencyCode': [
      {
        publicAddress: 'qpmq6uvs4sktft22lhlmsqpfr53hq03snc0s4nlwna',
        nativeAmount: '123456780',
        currencyCode: 'INVALID',
        metadata: {
          name: 'Johnny eCash',
          notes: 'Hello World, I miss you !'
        }
      }
    ]
  }
}
