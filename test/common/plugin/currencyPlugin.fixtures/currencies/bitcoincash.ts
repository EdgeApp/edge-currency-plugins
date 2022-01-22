import { airbitzSeeds, FixtureType, hexSeeds, key, mnemonics } from '../common'

export const bitcoincash: FixtureType = {
  pluginId: 'bitcoincash',
  WALLET_TYPE: 'wallet:bitcoincash',
  WALLET_FORMAT: 'bip44',
  'Test Currency code': 'BCH',
  key,
  xpub:
    'xpub6C7zQbq278xkqpJGb4Ewp9KSmJSdiqwYV45NCRDBLmgU9ighAuSsiDAicWm38ZXRUcYLnMEkH88tLF5ssfUMX3MtvrsgCmHYnmv2jHfev6z',
  'invalid key name': {
    id: 'unknown',
    type: 'wallet:bitcoincash',
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
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        metadata: {}
      }
    ],
    'address only2': [
      'bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy',
      {
        publicAddress: 'qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy',
        metadata: {}
      }
    ],
    'uri address': [
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        metadata: {}
      }
    ],
    'Ren Bridge Legacy Gateway address': [
      'bitcoincash://1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        legacyAddress: '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu',
        metadata: {
          gateway: true
        }
      }
    ],
    'Ren Bridge Legacy Gateway address mixed caps': [
      'bitCoinCash://1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        legacyAddress: '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu',
        metadata: {
          gateway: true
        }
      }
    ],
    'Ren Bridge new Gateway address': [
      'bitcoincash://qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        metadata: {
          gateway: true
        }
      }
    ],
    'Ren Bridge mixed caps Gateway address with address prefix': [
      'bitcoinCash://bitcoincash:pzyt5lcqp4u4wcwpwl8f8eq0hzpdnntzuy2h3nnalf',
      {
        publicAddress: 'pzyt5lcqp4u4wcwpwl8f8eq0hzpdnntzuy2h3nnalf',
        metadata: {
          gateway: true
        }
      }
    ],
    'Ren Bridge mixed caps Gateway address w/o address prefix': [
      'bitcoinCash://pzyt5lcqp4u4wcwpwl8f8eq0hzpdnntzuy2h3nnalf',
      {
        publicAddress: 'pzyt5lcqp4u4wcwpwl8f8eq0hzpdnntzuy2h3nnalf',
        metadata: {
          gateway: true
        }
      }
    ],
    'Ren Bridge weird caps Gateway address': [
      'BiTcOiNcAsH://bitcoincash:pzyt5lcqp4u4wcwpwl8f8eq0hzpdnntzuy2h3nnalf',
      {
        publicAddress: 'pzyt5lcqp4u4wcwpwl8f8eq0hzpdnntzuy2h3nnalf',
        metadata: {
          gateway: true
        }
      }
    ],
    'Ren Bridge new Gateway address with amount, label & message': [
      'bitcoincash://qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a?amount=1234.56789&label=Johnny%20Bitcoincash&message=Hello%20World,%20I%20miss%20you%20!',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        metadata: {
          name: 'Johnny Bitcoincash',
          notes: 'Hello World, I miss you !',
          gateway: true
        },
        nativeAmount: '123456789000',
        currencyCode: 'BCH'
      }
    ],
    'uri address with amount': [
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a?amount=12345.6789',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'BCH'
      }
    ],
    'uri address with amount & label': [
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a?amount=1234.56789&label=Johnny%20BitcoinCash',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        metadata: {
          name: 'Johnny BitcoinCash'
        },
        nativeAmount: '123456789000',
        currencyCode: 'BCH'
      }
    ],
    'uri address with amount, label & message': [
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a?amount=1234.56789&label=Johnny%20BitcoinCash&message=Hello%20World,%20I%20miss%20you%20!',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        metadata: {
          name: 'Johnny BitcoinCash',
          notes: 'Hello World, I miss you !'
        },
        nativeAmount: '123456789000',
        currencyCode: 'BCH'
      }
    ],
    'uri address with unsupported param': [
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a?unsupported=helloworld&amount=12345.6789',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'BCH'
      }
    ],
    'legacy address only': [
      '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        metadata: {},
        legacyAddress: '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu'
      }
    ],
    'legacy uri address': [
      'bitcoincash:1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        metadata: {},
        legacyAddress: '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu'
      }
    ],
    'legacy uri address with amount': [
      'bitcoincash:1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu?amount=12345.6789',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'BCH',
        legacyAddress: '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu'
      }
    ],
    'legacy uri address with amount & label': [
      'bitcoincash:1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu?amount=1234.56789&label=Johnny%20BitcoinCash',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        metadata: {
          name: 'Johnny BitcoinCash'
        },
        nativeAmount: '123456789000',
        currencyCode: 'BCH',
        legacyAddress: '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu'
      }
    ],
    'legacy uri address with amount, label & message': [
      'bitcoincash:1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu?amount=1234.56789&label=Johnny%20BitcoinCash&message=Hello%20World,%20I%20miss%20you%20!',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        metadata: {
          name: 'Johnny BitcoinCash',
          notes: 'Hello World, I miss you !'
        },
        nativeAmount: '123456789000',
        currencyCode: 'BCH',
        legacyAddress: '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu'
      }
    ],
    'legacy uri address with unsupported param': [
      'bitcoincash:1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu?unsupported=helloworld&amount=12345.6789',
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'BCH',
        legacyAddress: '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu'
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
      { publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a' },
      'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a'
    ],
    'legacy address1': [
      { publicAddress: '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu' },
      '1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu'
    ],
    'address & amount': [
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        nativeAmount: '123456780000'
      },
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a?amount=1234.5678'
    ],
    'address, amount, and label': [
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        nativeAmount: '123456780000',
        currencyCode: 'BCH',
        metadata: {
          name: 'Johnny BitcoinCash'
        }
      },
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a?amount=1234.5678&label=Johnny%20BitcoinCash'
    ],
    'address, amount, label, & message': [
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        nativeAmount: '123456780000',
        currencyCode: 'BCH',
        metadata: {
          name: 'Johnny BitcoinCash',
          notes: 'Hello World, I miss you !'
        }
      },
      'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a?amount=1234.5678&label=Johnny%20BitcoinCash&message=Hello%20World,%20I%20miss%20you%20!'
    ],
    'invalid currencyCode': [
      {
        publicAddress: 'qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a',
        nativeAmount: '123456780000',
        currencyCode: 'INVALID',
        metadata: {
          name: 'Johnny BitcoinCash',
          notes: 'Hello World, I miss you !'
        }
      }
    ]
  }
}
