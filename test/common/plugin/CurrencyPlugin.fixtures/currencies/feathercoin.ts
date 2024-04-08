import { airbitzSeeds, FixtureType, key, mnemonics } from '../common'

export const feathercoin: FixtureType = {
  pluginId: 'feathercoin',
  WALLET_TYPE: 'wallet:feathercoin',
  WALLET_FORMAT: 'bip44',
  'Test Currency code': 'FTC',
  key,
  // Prefix is not "xpub" due to Feathercoin's peculiar prefix version (0x0488bc26).
  // See electrumx for reference (https://github.com/spesmilo/electrumx/blob/0e321d2195b0b1536f2ffeb6f9181f3e3d5b8b0a/electrumx/lib/coins.py#L2105)
  xpub:
    'xq1vox5VzWCe9HcQp76dXjKZVCFhxu1QQgxkqvmPuN3s76hTHQBwJJ5vHxW51JsmbpFVrVKCL4McjJq9fqddMcUpXm4nZXJQKGCwaxcfixBJFPC',
  'invalid key name': {
    id: 'unknown',
    type: 'wallet:feathercoin',
    keys: {
      feathercoinKeyz: '12345678abcd',
      format: 'bip44'
    }
  },
  'invalid wallet type': {
    id: 'unknown',
    type: 'shitcoin',
    keys: { feathercoinKeyz: '12345678abcd' }
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
      '6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD',
      {
        publicAddress: '6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD',
        metadata: {}
      }
    ],
    'address only2': [
      '34edSxw6dnV1Jnmev1p1tkb1UoPEcwxRqH',
      {
        publicAddress: '34edSxw6dnV1Jnmev1p1tkb1UoPEcwxRqH',
        metadata: {}
      }
    ],
    'uri address': [
      'feathercoin:6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD',
      {
        publicAddress: '6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD',
        metadata: {}
      }
    ],
    'uri address with amount': [
      'feathercoin:6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD?amount=12345.6789',
      {
        publicAddress: '6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'FTC'
      }
    ],
    'uri address with amount & label': [
      'feathercoin:6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD?amount=1234.56789&label=Johnny%20feathercoin',
      {
        publicAddress: '6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD',
        metadata: {
          name: 'Johnny feathercoin'
        },
        nativeAmount: '123456789000',
        currencyCode: 'FTC'
      }
    ],
    'uri address with amount, label & message': [
      'feathercoin:6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD?amount=1234.56789&label=Johnny%20feathercoin&message=Hello%20World,%20I%20miss%20you%20!',
      {
        publicAddress: '6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD',
        metadata: {
          name: 'Johnny feathercoin',
          notes: 'Hello World, I miss you !'
        },
        nativeAmount: '123456789000',
        currencyCode: 'FTC'
      }
    ],
    'uri address with unsupported param': [
      'feathercoin:6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD?unsupported=helloworld&amount=12345.6789',
      {
        publicAddress: '6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'FTC'
      }
    ],
    'wif 1 - Compressed': [
      'N47FY4qJv91pFpYyFFwryQ6TtnQyZoPwHhxfSnwK7G7hfodE6rhV',
      {
        metadata: {},
        privateKeys: ['N47FY4qJv91pFpYyFFwryQ6TtnQyZoPwHhxfSnwK7G7hfodE6rhV']
      }
    ],
    'wif 2 - Compressed': [
      'N53U9kfZWsLMZq9o3iPZELGpbdTV3m8xS7MXSPHzqECSfjirLgeg',
      {
        metadata: {},
        privateKeys: ['N53U9kfZWsLMZq9o3iPZELGpbdTV3m8xS7MXSPHzqECSfjirLgeg']
      }
    ],
    'wif 3 - Compressed': [
      'N4ScbPqYDbVhLJwdM8RZwAkEYbiUvzRds9a9kJr16HMrmkYeVQ5S',
      {
        metadata: {},
        privateKeys: ['N4ScbPqYDbVhLJwdM8RZwAkEYbiUvzRds9a9kJr16HMrmkYeVQ5S']
      }
    ],
    'wif 1 - Non Compressed': [
      '5mqebQ4pSz8iSRG2qKCozVwreLk9xPqZi8PatU4XhvUR74RsHHX',
      {
        metadata: {},
        privateKeys: ['5mqebQ4pSz8iSRG2qKCozVwreLk9xPqZi8PatU4XhvUR74RsHHX']
      }
    ],
    'wif 2 - Non Compressed': [
      '5mXfNw2PmToNzMjCVbKHbwkLCLU6rXdxiPGEMXUz4xdQHFocors',
      {
        metadata: {},
        privateKeys: ['5mXfNw2PmToNzMjCVbKHbwkLCLU6rXdxiPGEMXUz4xdQHFocors']
      }
    ],
    'wif 3 - Non Compressed': [
      '5mYYGU3ixuUq3o55iTbsBLwPonjbToHBqTvXtKzzSqPg3Gpjhvd',
      {
        metadata: {},
        privateKeys: ['5mYYGU3ixuUq3o55iTbsBLwPonjbToHBqTvXtKzzSqPg3Gpjhvd']
      }
    ]
  },
  encodeUri: {
    'address only': [
      { publicAddress: '6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD' },
      '6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD'
    ],
    'legacy address1': [
      { publicAddress: '34YtuLdPgopC8xNMKo98oJkGmeSQUrUWvc' },
      '34YtuLdPgopC8xNMKo98oJkGmeSQUrUWvc'
    ],
    'legacy address2': [
      { publicAddress: '6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD' },
      '6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD'
    ],
    'new format address': [
      { publicAddress: 'fc1q4apxcls6tfrjmuhjjg2vw5csecc7yzjdp73y44' },
      'fc1q4apxcls6tfrjmuhjjg2vw5csecc7yzjdp73y44'
    ],
    'address & amount': [
      {
        publicAddress: '6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD',
        nativeAmount: '123456780000'
      },
      'feathercoin:6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD?amount=1234.5678'
    ],
    'address, amount, and label': [
      {
        publicAddress: '6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD',
        nativeAmount: '123456780000',
        currencyCode: 'FTC',
        metadata: {
          name: 'Johnny feathercoin'
        }
      },
      'feathercoin:6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD?amount=1234.5678&label=Johnny%20feathercoin'
    ],
    'address, amount, label, & message': [
      {
        publicAddress: '6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD',
        nativeAmount: '123456780000',
        currencyCode: 'FTC',
        metadata: {
          name: 'Johnny feathercoin',
          notes: 'Hello World, I miss you !'
        }
      },
      'feathercoin:6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD?amount=1234.5678&label=Johnny%20feathercoin&message=Hello%20World,%20I%20miss%20you%20!'
    ],
    'invalid currencyCode': [
      {
        publicAddress: '6fLKmA19ESYgg5HPq9q3UvY3EJ6HThr5DD',
        nativeAmount: '123456780000',
        currencyCode: 'INVALID',
        metadata: {
          name: 'Johnny feathercoin',
          notes: 'Hello World, I miss you !'
        }
      }
    ]
  }
}
