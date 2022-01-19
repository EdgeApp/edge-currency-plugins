import { FixtureType, key } from '../common'

export const bitcoin: FixtureType = {
  pluginId: 'bitcoin',
  WALLET_TYPE: 'wallet:bitcoin',
  WALLET_FORMAT: 'bip32',
  'Test Currency code': 'BTC',
  key,
  xpub:
    'xpub69FqMgncSEcrs989ejBWTBBcDNFDqkwEd7y53pVeXm8368TNfb9jCd2ne3ccpx9vvgBdpv79Edc69i2Q69kXtrdmLcQM8seffnCXzwzvWa6',
  'invalid key name': {
    id: 'unknown',
    type: 'wallet:bitcoin',
    keys: { bitcoinKeyz: '12345678abcd' }
  },
  'invalid wallet type': {
    id: 'unknown',
    type: 'shitcoin',
    keys: { bitcoinKeyz: '12345678abcd' }
  },
  parseUri: {
    'address only': [
      '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        metadata: {}
      }
    ],
    'address only2': [
      '3LDsS579y7sruadqu11beEJoTjdFiFCdX4',
      {
        publicAddress: '3LDsS579y7sruadqu11beEJoTjdFiFCdX4',
        metadata: {}
      }
    ],
    'address only3': [
      'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
      {
        publicAddress: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        metadata: {}
      }
    ],
    'address only4': [
      'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3',
      {
        publicAddress:
          'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3',
        metadata: {}
      }
    ],
    'uri address': [
      'bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        metadata: {}
      }
    ],
    'Ren Bridge p2wpkhp2sh Gateway address': [
      'bitcoin://3Lx24A66XeL1HtegyNoku77qvNBCbEqePj',
      {
        publicAddress: '3Lx24A66XeL1HtegyNoku77qvNBCbEqePj',
        metadata: {
          gateway: true
        }
      }
    ],
    'Ren Bridge p2pkh Gateway address': [
      'bitcoin://1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        metadata: {
          gateway: true
        }
      }
    ],
    'Ren Bridge p2wpkhp2sh Gateway address mixed caps': [
      'bitCoin://3Lx24A66XeL1HtegyNoku77qvNBCbEqePj',
      {
        publicAddress: '3Lx24A66XeL1HtegyNoku77qvNBCbEqePj',
        metadata: {
          gateway: true
        }
      }
    ],
    'Ren Bridge p2pkh Gateway address mixed caps': [
      'Bitcoin://1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        metadata: {
          gateway: true
        }
      }
    ],
    'Ren Bridge p2pkh Gateway address with amount, label & message': [
      'bitcoin://1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1234.56789&label=Johnny%20Bitcoin&message=Hello%20World,%20I%20miss%20you%20!',
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        metadata: {
          name: 'Johnny Bitcoin',
          notes: 'Hello World, I miss you !',
          gateway: true
        },
        nativeAmount: '123456789000',
        currencyCode: 'BTC'
      }
    ],
    'Ren Bridge bech32 Gateway address': [
      'bitcoin://bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3',
      {
        publicAddress:
          'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3',
        metadata: {
          gateway: true
        }
      }
    ],
    'uri address with amount': [
      'bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=12345.6789',
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'BTC'
      }
    ],
    'uri address with amount and without prefix': [
      '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=12345.6789',
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'BTC'
      }
    ],
    'uri address with amount & label': [
      'bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1234.56789&label=Johnny%20Bitcoin',
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        metadata: {
          name: 'Johnny Bitcoin'
        },
        nativeAmount: '123456789000',
        currencyCode: 'BTC'
      }
    ],
    'uri address with amount, label & message': [
      'bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1234.56789&label=Johnny%20Bitcoin&message=Hello%20World,%20I%20miss%20you%20!',
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        metadata: {
          name: 'Johnny Bitcoin',
          notes: 'Hello World, I miss you !'
        },
        nativeAmount: '123456789000',
        currencyCode: 'BTC'
      }
    ],
    'uri address with unsupported param': [
      'bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?unsupported=helloworld&amount=12345.6789',
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'BTC'
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
    ],
    'backwards compatible bip70': [
      'bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=0.11&r=https://merchant.com/pay.php?h%3D2a8628fc2fbe',
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        metadata: {},
        nativeAmount: '11000000',
        currencyCode: 'BTC',
        paymentProtocolUrl: 'https://merchant.com/pay.php?h=2a8628fc2fbe'
      }
    ],
    'non backwards compatible bip70': [
      'bitcoin:?r=https://merchant.com/pay.php?h%3D2a8628fc2fbe',
      {
        metadata: {},
        paymentProtocolUrl: 'https://merchant.com/pay.php?h=2a8628fc2fbe'
      }
    ]
  },
  encodeUri: {
    'address only': [
      { publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX' },
      '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX'
    ],
    'legacy address1': [
      { publicAddress: '34YtuLdPgopC8xNMKo98oJkGmeSQUrUWvc' },
      '34YtuLdPgopC8xNMKo98oJkGmeSQUrUWvc'
    ],
    'legacy address2': [
      { publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX' },
      '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX'
    ],
    'legacy address': [
      { publicAddress: '34YtuLdPgopC8xNMKo98oJkGmeSQUrUWvc' },
      '34YtuLdPgopC8xNMKo98oJkGmeSQUrUWvc'
    ],
    'new format address': [
      { publicAddress: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' },
      'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
    ],
    'address & amount': [
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        nativeAmount: '123456780000'
      },
      'bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1234.5678'
    ],
    'address, amount, and label': [
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        nativeAmount: '123456780000',
        currencyCode: 'BTC',
        metadata: {
          name: 'Johnny Bitcoin'
        }
      },
      'bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1234.5678&label=Johnny%20Bitcoin'
    ],
    'address, amount, label, & message': [
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        nativeAmount: '123456780000',
        currencyCode: 'BTC',
        metadata: {
          name: 'Johnny Bitcoin',
          notes: 'Hello World, I miss you !'
        }
      },
      'bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1234.5678&label=Johnny%20Bitcoin&message=Hello%20World,%20I%20miss%20you%20!'
    ],
    'invalid currencyCode': [
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        nativeAmount: '123456780000',
        currencyCode: 'INVALID',
        metadata: {
          name: 'Johnny Bitcoin',
          notes: 'Hello World, I miss you !'
        }
      }
    ]
  },
  getSplittableTypes: {
    bip32: ['wallet:bitcoincash', 'wallet:bitcoingold'],
    bip44: ['wallet:bitcoincash', 'wallet:bitcoingold'],
    bip49: ['wallet:bitcoingold'],
    bip84: ['wallet:bitcoingold']
  }
}
