import { airbitzSeeds, FixtureType, hexSeeds, key, mnemonics } from '../common'

export const litecoin: FixtureType = {
  pluginId: 'litecoin',
  WALLET_TYPE: 'wallet:litecoin',
  WALLET_FORMAT: 'bip44',
  'Test Currency code': 'LTC',
  key,
  xpub:
    'xpub6CUgpZYSditAHLGHepYbZzskB16AQx69mnD5iUVjd7pdWjP67ZzMNCw8n8Sg2xidi2pVAd35rbeYjxSr5CMUfEGgggFr8Z4bwm1n8YpV8Rn',
  'invalid key name': {
    id: 'unknown',
    type: 'wallet:litecoin',
    keys: {
      litecoinKeyz: '12345678abcd',
      format: 'bip44'
    }
  },
  'invalid wallet type': {
    id: 'unknown',
    type: 'shitcoin',
    keys: { litecoinKeyz: '12345678abcd' }
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
      'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
      {
        publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
        metadata: {}
      }
    ],
    'address only2': [
      'MSS1jxX7vEjHi5ujzszwTsZCnSDhkWKrBd',
      {
        publicAddress: 'MSS1jxX7vEjHi5ujzszwTsZCnSDhkWKrBd',
        metadata: {}
      }
    ],
    'uri address': [
      'litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
      {
        publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
        metadata: {}
      }
    ],
    'uri address with amount': [
      'litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T?amount=12345.6789',
      {
        publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'LTC'
      }
    ],
    'uri address with amount & label': [
      'litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T?amount=1234.56789&label=Johnny%20Litecoin',
      {
        publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
        metadata: {
          name: 'Johnny Litecoin'
        },
        nativeAmount: '123456789000',
        currencyCode: 'LTC'
      }
    ],
    'uri address with amount, label & message': [
      'litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T?amount=1234.56789&label=Johnny%20Litecoin&message=Hello%20World,%20I%20miss%20you%20!',
      {
        publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
        metadata: {
          name: 'Johnny Litecoin',
          notes: 'Hello World, I miss you !'
        },
        nativeAmount: '123456789000',
        currencyCode: 'LTC'
      }
    ],
    'uri address with unsupported param': [
      'litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T?unsupported=helloworld&amount=12345.6789',
      {
        publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'LTC'
      }
    ],
    'legacy address only': [
      '3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN',
      {
        publicAddress: 'MLh6oJm8tWbTNKTXpiREMoAMqE3CbYzgi6',
        metadata: {},
        legacyAddress: '3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN'
      }
    ],
    'legacy uri address': [
      'litecoin:3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN',
      {
        publicAddress: 'MLh6oJm8tWbTNKTXpiREMoAMqE3CbYzgi6',
        metadata: {},
        legacyAddress: '3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN'
      }
    ],
    'legacy uri address with amount': [
      'litecoin:3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN?amount=12345.6789',
      {
        publicAddress: 'MLh6oJm8tWbTNKTXpiREMoAMqE3CbYzgi6',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'LTC',
        legacyAddress: '3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN'
      }
    ],
    'legacy uri address with amount & label': [
      'litecoin:3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN?amount=1234.56789&label=Johnny%20Litecoin',
      {
        publicAddress: 'MLh6oJm8tWbTNKTXpiREMoAMqE3CbYzgi6',
        metadata: {
          name: 'Johnny Litecoin'
        },
        nativeAmount: '123456789000',
        currencyCode: 'LTC',
        legacyAddress: '3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN'
      }
    ],
    'legacy uri address with amount, label & message': [
      'litecoin:3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN?amount=1234.56789&label=Johnny%20Litecoin&message=Hello%20World,%20I%20miss%20you%20!',
      {
        publicAddress: 'MLh6oJm8tWbTNKTXpiREMoAMqE3CbYzgi6',
        metadata: {
          name: 'Johnny Litecoin',
          notes: 'Hello World, I miss you !'
        },
        nativeAmount: '123456789000',
        currencyCode: 'LTC',
        legacyAddress: '3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN'
      }
    ],
    'legacy uri address with unsupported param': [
      'litecoin:3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN?unsupported=helloworld&amount=12345.6789',
      {
        publicAddress: 'MLh6oJm8tWbTNKTXpiREMoAMqE3CbYzgi6',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'LTC',
        legacyAddress: '3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN'
      }
    ],
    'wif 1 - Compressed': [
      'T5t9N5NirTH5Bo65CEm1Z5W7jyu9ezbuMvPzuD2DoPnPGJkmpq8B',
      {
        metadata: {},
        privateKeys: ['T5t9N5NirTH5Bo65CEm1Z5W7jyu9ezbuMvPzuD2DoPnPGJkmpq8B']
      }
    ],
    'wif 2 - Compressed': [
      'T3A5JtqoKrmR4AVEdXdmbB6kGLpt5iWp54cUw3udZuHX3PKLymvR',
      {
        metadata: {},
        privateKeys: ['T3A5JtqoKrmR4AVEdXdmbB6kGLpt5iWp54cUw3udZuHX3PKLymvR']
      }
    ],
    'wif 3 - Compressed': [
      'T4ZYxYMAE85w5moF5FBCiQjLiorr346tyPkz4m8tHCQBXsjL8zm7',
      {
        metadata: {},
        privateKeys: ['T4ZYxYMAE85w5moF5FBCiQjLiorr346tyPkz4m8tHCQBXsjL8zm7']
      }
    ],
    'wif 1 - Non Compressed': [
      '6vzHEqCk5kUSL8KBZr4XhfiDTwiihLKaMAdb6dhhq34tabicz73',
      {
        metadata: {},
        privateKeys: ['6vzHEqCk5kUSL8KBZr4XhfiDTwiihLKaMAdb6dhhq34tabicz73']
      }
    ],
    'wif 2 - Non Compressed': [
      '6vNUJU9VXjs79rr9jvqsoXFekNStYnYMnC287mnAovUhnTbA8cF',
      {
        metadata: {},
        privateKeys: ['6vNUJU9VXjs79rr9jvqsoXFekNStYnYMnC287mnAovUhnTbA8cF']
      }
    ],
    'wif 3 - Non Compressed': [
      '6vusDCJqPM7KVAiMzXL8F27MWTfZ5sw8XJL1XT9wwgDMhfcugVQ',
      {
        metadata: {},
        privateKeys: ['6vusDCJqPM7KVAiMzXL8F27MWTfZ5sw8XJL1XT9wwgDMhfcugVQ']
      }
    ],
    'backwards compatible bip70': [
      'litecoin:3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN?amount=0.11&r=https://merchant.com/pay.php?h%3D2a8628fc2fbe',
      {
        publicAddress: 'MLh6oJm8tWbTNKTXpiREMoAMqE3CbYzgi6',
        legacyAddress: '3EUxVRMAwPk2ZpBdiqRtY9uxWXSkgVCTFN',
        metadata: {},
        nativeAmount: '11000000',
        currencyCode: 'LTC',
        paymentProtocolUrl: 'https://merchant.com/pay.php?h=2a8628fc2fbe'
      }
    ],
    'non backwards compatible bip70': [
      'litecoin:?r=https://merchant.com/pay.php?h%3D2a8628fc2fbe',
      {
        metadata: {},
        paymentProtocolUrl: 'https://merchant.com/pay.php?h=2a8628fc2fbe'
      }
    ]
  },
  encodeUri: {
    'address only': [
      { publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T' },
      'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T'
    ],
    'legacy address1': [
      { publicAddress: '34YtuLdPgopC8xNMKo98oJkGmeSQUrUWvc' },
      '34YtuLdPgopC8xNMKo98oJkGmeSQUrUWvc'
    ],
    'legacy address2': [
      { publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T' },
      'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T'
    ],
    'legacy address3': [
      { publicAddress: 'M816EdyuvWV7oETCfQeZb5mGWm9nHczijH' },
      'M816EdyuvWV7oETCfQeZb5mGWm9nHczijH'
    ],
    'new format address': [
      { publicAddress: 'MJiPwX84iBe4WnFDwsYGgtnz1XonPhUqhf' },
      'MJiPwX84iBe4WnFDwsYGgtnz1XonPhUqhf'
    ],
    'address & amount': [
      {
        publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
        nativeAmount: '123456780000'
      },
      'litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T?amount=1234.5678'
    ],
    'address, amount, and label': [
      {
        publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
        nativeAmount: '123456780000',
        currencyCode: 'LTC',
        metadata: {
          name: 'Johnny Litecoin'
        }
      },
      'litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T?amount=1234.5678&label=Johnny%20Litecoin'
    ],
    'address, amount, label, & message': [
      {
        publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
        nativeAmount: '123456780000',
        currencyCode: 'LTC',
        metadata: {
          name: 'Johnny Litecoin',
          notes: 'Hello World, I miss you !'
        }
      },
      'litecoin:LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T?amount=1234.5678&label=Johnny%20Litecoin&message=Hello%20World,%20I%20miss%20you%20!'
    ],
    'invalid currencyCode': [
      {
        publicAddress: 'LajyQBeZaBA1NkZDeY8YT5RYYVRkXMvb2T',
        nativeAmount: '123456780000',
        currencyCode: 'INVALID',
        metadata: {
          name: 'Johnny Litecoin',
          notes: 'Hello World, I miss you !'
        }
      }
    ]
  }
}
