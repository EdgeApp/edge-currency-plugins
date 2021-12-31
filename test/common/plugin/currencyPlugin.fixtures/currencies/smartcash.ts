import { FixtureType, key } from '../common'

export const smartcash: FixtureType = {
  pluginId: 'smartcash',
  WALLET_TYPE: 'wallet:smartcash',
  'Test Currency code': 'SMART',
  WALLET_FORMAT: 'bip44',
  key,
  xpub:
    'xpub6DVeXNsPJet3rgM2RbNdaE7e5AKWYQuMSHFMcCMya39KhjGgTB8D9LKDWBLggVgF5V2gVEz3VBeiyh4S4q9vgC8fFUdDdAqBQTc9BN16rTd',
  'invalid key name': {
    id: 'unknown',
    type: 'wallet:smartcash',
    keys: {
      smartcashKeyz: '12345678abcd',
      format: 'bip44'
    }
  },
  'invalid wallet type': {
    id: 'unknown',
    type: 'shitcoin',
    keys: { smartcashKeyz: '12345678abcd' }
  },
  parseUri: {
    'address only': [
      'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH',
      {
        publicAddress: 'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH',
        metadata: {}
      }
    ],
    'address only2': [
      'SbpLx8iLAiJavTSsPd8NayHv4VAvgDASqm',
      {
        publicAddress: 'SbpLx8iLAiJavTSsPd8NayHv4VAvgDASqm',
        metadata: {}
      }
    ],
    'uri address': [
      'smartcash:ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH',
      {
        publicAddress: 'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH',
        metadata: {}
      }
    ],
    'uri address with amount': [
      'smartcash:ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH?amount=12345.6789',
      {
        publicAddress: 'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'SMART'
      }
    ],
    'uri address with amount & label': [
      'smartcash:ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH?amount=1234.56789&label=Johnny%20smartcash',
      {
        publicAddress: 'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH',
        metadata: {
          name: 'Johnny smartcash'
        },
        nativeAmount: '123456789000',
        currencyCode: 'SMART'
      }
    ],
    'uri address with amount, label & message': [
      'smartcash:ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH?amount=1234.56789&label=Johnny%20smartcash&message=Hello%20World,%20I%20miss%20you%20!',
      {
        publicAddress: 'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH',
        metadata: {
          name: 'Johnny smartcash',
          notes: 'Hello World, I miss you !'
        },
        nativeAmount: '123456789000',
        currencyCode: 'SMART'
      }
    ],
    'uri address with unsupported param': [
      'smartcash:ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH?unsupported=helloworld&amount=12345.6789',
      {
        publicAddress: 'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'SMART'
      }
    ],
    'wif 1 - Non Compressed': [
      'VLqHRdvdNPgspEjPM6ee5CcLKc4CFBvafN183pevjxXKX1uZGe1m',
      {
        metadata: {},
        privateKeys: ['VLqHRdvdNPgspEjPM6ee5CcLKc4CFBvafN183pevjxXKX1uZGe1m']
      }
    ],
    'wif 2 - Non Compressed': [
      'VMmoBs8yPgCuxFXpdtFfvKvFyPVd2sBzPX2qfnLvL2F98RtF2eY6',
      {
        metadata: {},
        privateKeys: ['VMmoBs8yPgCuxFXpdtFfvKvFyPVd2sBzPX2qfnLvL2F98RtF2eY6']
      }
    ],
    'wif 3 - Non Compressed': [
      'VPVHLd9Yw2gr8DX2UcJHwKEHLEZZpLyv2ZBGyNRXdBuKjieCWv45',
      {
        metadata: {},
        privateKeys: ['VPVHLd9Yw2gr8DX2UcJHwKEHLEZZpLyv2ZBGyNRXdBuKjieCWv45']
      }
    ]
  },
  encodeUri: {
    'address only': [
      { publicAddress: 'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH' },
      'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH'
    ],
    'legacy address1': [
      { publicAddress: 'SUMxvsfKB4aqs3vq9pBydsDafxHWRSoUik' },
      'SUMxvsfKB4aqs3vq9pBydsDafxHWRSoUik'
    ],
    'legacy address2': [
      { publicAddress: 'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH' },
      'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH'
    ],
    'new format address': [
      { publicAddress: 'SdH3wzDKrXSuaHpjrEh8CLx44LsqcRbqcT' },
      'SdH3wzDKrXSuaHpjrEh8CLx44LsqcRbqcT'
    ],
    'address & amount': [
      {
        publicAddress: 'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH',
        nativeAmount: '123456780000'
      },
      'smartcash:ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH?amount=1234.5678'
    ],
    'address, amount, and label': [
      {
        publicAddress: 'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH',
        nativeAmount: '123456780000',
        currencyCode: 'SMART',
        metadata: {
          name: 'Johnny smartcash'
        }
      },
      'smartcash:ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH?amount=1234.5678&label=Johnny%20smartcash'
    ],
    'address, amount, label, & message': [
      {
        publicAddress: 'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH',
        nativeAmount: '123456780000',
        currencyCode: 'SMART',
        metadata: {
          name: 'Johnny smartcash',
          notes: 'Hello World, I miss you !'
        }
      },
      'smartcash:ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH?amount=1234.5678&label=Johnny%20smartcash&message=Hello%20World,%20I%20miss%20you%20!'
    ],
    'invalid currencyCode': [
      {
        publicAddress: 'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH',
        nativeAmount: '123456780000',
        currencyCode: 'INVALID',
        metadata: {
          name: 'Johnny smartcash',
          notes: 'Hello World, I miss you !'
        }
      }
    ]
  }
}
