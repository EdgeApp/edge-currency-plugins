import { airbitzSeeds, FixtureType, hexSeeds, key, mnemonics } from '../common'

export const bitcoinsv: FixtureType = {
  pluginId: 'bitcoinsv',
  WALLET_TYPE: 'wallet:bitcoinsv',
  WALLET_FORMAT: 'bip44',
  'Test Currency code': 'BSV',
  key,
  xpub:
    'xpub6DUTiSS733hqT58ikbarGvhNzCHXT448nTbZt7sY2uXfY5fFBE6QZjojE74rNXkbMrxG3xWugPT1q5Diqjp9wdmNoGCpuntmCg5bVqsx81K',
  'invalid key name': {
    id: 'unknown',
    type: 'wallet:bitcoinsv',
    keys: {
      bitcoincashKeyz: '12345678abcd',
      format: 'bip44'
    }
  },
  'invalid wallet type': {
    id: 'unknown',
    type: 'shitcoin',
    keys: { bitcoincashKeyz: '12345678abcd' }
  },
  importKey: {
    validKeys: [...mnemonics, ...hexSeeds],
    invalidKeys: [
      ...airbitzSeeds.map(seed => seed.slice(1)),
      ...hexSeeds.map(seed => seed.slice(1)),
      ...mnemonics.map(mnemonic => mnemonic.split(' ').slice(1).join(' ')),
      'bunch of garbly gook !@#$%^&*()'
    ],
    unsupportedKeys: airbitzSeeds
  },
  parseUri: {
    'address only': [
      '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb',
      {
        publicAddress: '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb',
        metadata: {}
      }
    ],
    'address only2': [
      '3CWFddi6m4ndiGyKqzYvsFYagqDLPVMTzC',
      {
        publicAddress: '3CWFddi6m4ndiGyKqzYvsFYagqDLPVMTzC',
        metadata: {}
      }
    ],
    'uri address': [
      'bitcoin:16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb',
      {
        publicAddress: '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb',
        metadata: {}
      }
    ],
    'uri address with amount': [
      'bitcoin:3CWFddi6m4ndiGyKqzYvsFYagqDLPVMTzC?amount=12345.6789',
      {
        publicAddress: '3CWFddi6m4ndiGyKqzYvsFYagqDLPVMTzC',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'BSV'
      }
    ],
    'uri address with amount & label': [
      'bitcoin:16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb?amount=1234.56789&label=Johnny%20BitcoinSV',
      {
        publicAddress: '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb',
        metadata: {
          name: 'Johnny BitcoinSV'
        },
        nativeAmount: '123456789000',
        currencyCode: 'BSV'
      }
    ],
    'uri address with amount, label & message': [
      'bitcoin:16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb?amount=1234.56789&label=Johnny%20BitcoinSV&message=Hello%20World,%20I%20miss%20you%20!',
      {
        publicAddress: '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb',
        metadata: {
          name: 'Johnny BitcoinSV',
          notes: 'Hello World, I miss you !'
        },
        nativeAmount: '123456789000',
        currencyCode: 'BSV'
      }
    ],
    'uri address with unsupported param': [
      'bitcoin:16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb?unsupported=helloworld&amount=12345.6789',
      {
        publicAddress: '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'BSV'
      }
    ],
    'wif 1 - Compressed': [
      'L5FyMaAPJGqivZmCzFAEATptdvgha4UqwVWbLLZgr5iLGtQRo4x2',
      {
        metadata: {},
        privateKeys: ['L5FyMaAPJGqivZmCzFAEATptdvgha4UqwVWbLLZgr5iLGtQRo4x2']
      }
    ],
    'wif 2 - Compressed': [
      'KzjzkvbBjyaVeECBJFFv5eTwRrsQ4eBg8BNoPpr1z6tjyua6KGEd',
      {
        metadata: {},
        privateKeys: ['KzjzkvbBjyaVeECBJFFv5eTwRrsQ4eBg8BNoPpr1z6tjyua6KGEd']
      }
    ],
    'wif 3 - Compressed': [
      'Kzfwq67yZCotkVShh6tvFZ2WZCZ3C6CLpt9ec2LA3Zdpm17ynXac',
      {
        metadata: {},
        privateKeys: ['Kzfwq67yZCotkVShh6tvFZ2WZCZ3C6CLpt9ec2LA3Zdpm17ynXac']
      }
    ],
    'wif 1 - Non Compressed': [
      '5Kb8kLf9zgWQnogidDA76MzPL6TsZZY36hWXMssSzNydYXYB9KF',
      {
        metadata: {},
        privateKeys: ['5Kb8kLf9zgWQnogidDA76MzPL6TsZZY36hWXMssSzNydYXYB9KF']
      }
    ],
    'wif 2 - Non Compressed': [
      '5Hpu8shonqW1TomfUat1RQBjyabiwyQYqara7nUM3YRGU9hx8Eg',
      {
        metadata: {},
        privateKeys: ['5Hpu8shonqW1TomfUat1RQBjyabiwyQYqara7nUM3YRGU9hx8Eg']
      }
    ],
    'wif 3 - Non Compressed': [
      '5JJY5LkdXsRSh1X2pLMezk3f11wHkSBJM1AmJ6zKJyzJtQnAe3F',
      {
        metadata: {},
        privateKeys: ['5JJY5LkdXsRSh1X2pLMezk3f11wHkSBJM1AmJ6zKJyzJtQnAe3F']
      }
    ]
  },
  encodeUri: {
    'address only': [
      { publicAddress: '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb' },
      '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb'
    ],
    'legacy address1': [
      { publicAddress: '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu' },
      '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu'
    ],
    'address & amount': [
      {
        publicAddress: '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb',
        nativeAmount: '123456780000'
      },
      'bitcoin:16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb?amount=1234.5678'
    ],
    'address, amount, and label': [
      {
        publicAddress: '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb',
        nativeAmount: '123456780000',
        currencyCode: 'BSV',
        metadata: {
          name: 'Johnny BitcoinSV'
        }
      },
      'bitcoin:16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb?amount=1234.5678&label=Johnny%20BitcoinSV'
    ],
    'address, amount, label, & message': [
      {
        publicAddress: '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb',
        nativeAmount: '123456780000',
        currencyCode: 'BSV',
        metadata: {
          name: 'Johnny BitcoinSV',
          notes: 'Hello World, I miss you !'
        }
      },
      'bitcoin:16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb?amount=1234.5678&label=Johnny%20BitcoinSV&message=Hello%20World,%20I%20miss%20you%20!'
    ],
    'invalid currencyCode': [
      {
        publicAddress: '16w1D5WRVKJuZUsSRzdLp9w3YGcgoxDXb',
        nativeAmount: '123456780000',
        currencyCode: 'INVALID',
        metadata: {
          name: 'Johnny BitcoinSV',
          notes: 'Hello World, I miss you !'
        }
      }
    ]
  }
}
