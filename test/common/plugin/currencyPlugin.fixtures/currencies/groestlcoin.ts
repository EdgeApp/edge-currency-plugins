import { FixtureType, key } from '../common'

export const groestlcoin: FixtureType = {
  pluginId: 'groestlcoin',
  WALLET_TYPE: 'wallet:groestlcoin',
  'Test Currency code': 'GRS',
  WALLET_FORMAT: 'bip49',
  key,
  xpub:
    'ypub6YHHt2GZYfDH8ZFrFPkK1jWiXLwks9d8pNGKBHjEnuvBewzW3tWaRWxoBWp81K3igWdUa8mDQx9LpxzewqJC22wyuQ88KtgtE58FN35J6hc',
  'invalid key name': {
    id: 'unknown',
    type: 'wallet:groestlcoin',
    keys: {
      groestlcoinKeyz: '12345678abcd',
      format: 'bip49'
    }
  },
  'invalid wallet type': {
    id: 'unknown',
    type: 'shitcoin',
    keys: { groestlcoinKeyz: '12345678abcd' }
  },
  parseUri: {
    'address only': [
      '3933BTHZdySDxk7PBqtPjARNfcj1ULbatY',
      {
        publicAddress: '3933BTHZdySDxk7PBqtPjARNfcj1ULbatY',
        metadata: {}
      }
    ],
    'address only2': [
      'FhnTYU7uu52ozkEqbYZqnwL1azyr44cN4q',
      {
        publicAddress: 'FhnTYU7uu52ozkEqbYZqnwL1azyr44cN4q',
        metadata: {}
      }
    ],
    'address only3': [
      'grs1qyzpu545r3pelyp4kktmr3hxfhwchyqmkk5w7l5',
      {
        publicAddress: 'grs1qyzpu545r3pelyp4kktmr3hxfhwchyqmkk5w7l5',
        metadata: {}
      }
    ],
    'uri address': [
      'groestlcoin:3933BTHZdySDxk7PBqtPjARNfcj1ULbatY',
      {
        publicAddress: '3933BTHZdySDxk7PBqtPjARNfcj1ULbatY',
        metadata: {}
      }
    ],
    'uri address with amount': [
      'groestlcoin:3933BTHZdySDxk7PBqtPjARNfcj1ULbatY?amount=12345.6789',
      {
        publicAddress: '3933BTHZdySDxk7PBqtPjARNfcj1ULbatY',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'GRS'
      }
    ],
    'uri address with amount & label': [
      'groestlcoin:3933BTHZdySDxk7PBqtPjARNfcj1ULbatY?amount=1234.56789&label=Johnny%20groestlcoin',
      {
        publicAddress: '3933BTHZdySDxk7PBqtPjARNfcj1ULbatY',
        metadata: {
          name: 'Johnny groestlcoin'
        },
        nativeAmount: '123456789000',
        currencyCode: 'GRS'
      }
    ],
    'uri address with amount, label & message': [
      'groestlcoin:3933BTHZdySDxk7PBqtPjARNfcj1ULbatY?amount=1234.56789&label=Johnny%20groestlcoin&message=Hello%20World,%20I%20miss%20you%20!',
      {
        publicAddress: '3933BTHZdySDxk7PBqtPjARNfcj1ULbatY',
        metadata: {
          name: 'Johnny groestlcoin',
          notes: 'Hello World, I miss you !'
        },
        nativeAmount: '123456789000',
        currencyCode: 'GRS'
      }
    ],
    'uri address with unsupported param': [
      'groestlcoin:3933BTHZdySDxk7PBqtPjARNfcj1ULbatY?unsupported=helloworld&amount=12345.6789',
      {
        publicAddress: '3933BTHZdySDxk7PBqtPjARNfcj1ULbatY',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'GRS'
      }
    ],
    'wif 1 - Compressed': [
      '5KZF3uBKFVgFpGGVuj1nihZGSFaovM4i32BXGTHENHF5ytp5e2g',
      {
        metadata: {},
        privateKeys: ['5KZF3uBKFVgFpGGVuj1nihZGSFaovM4i32BXGTHENHF5ytp5e2g']
      }
    ],
    'wif 2 - Compressed': [
      'L3JqVWfMMvd62HYpeUEX7xWk5K24j4KuP8NeCYr3mL9UY9qQ8Zw4',
      {
        metadata: {},
        privateKeys: ['L3JqVWfMMvd62HYpeUEX7xWk5K24j4KuP8NeCYr3mL9UY9qQ8Zw4']
      }
    ],
    'wif 1 - Non Compressed': [
      'L1qoZLKEyzShjLNxSbXw1xXgvj8CHMoNKVjek5uEB6DY39udr3Nc',
      {
        metadata: {},
        privateKeys: ['L1qoZLKEyzShjLNxSbXw1xXgvj8CHMoNKVjek5uEB6DY39udr3Nc']
      }
    ]
  },
  encodeUri: {
    'address only': [
      { publicAddress: '3933BTHZdySDxk7PBqtPjARNfcj1ULbatY' },
      '3933BTHZdySDxk7PBqtPjARNfcj1ULbatY'
    ],
    'legacy address2': [
      { publicAddress: '3933BTHZdySDxk7PBqtPjARNfcj1ULbatY' },
      '3933BTHZdySDxk7PBqtPjARNfcj1ULbatY'
    ],
    'address & amount': [
      {
        publicAddress: '3933BTHZdySDxk7PBqtPjARNfcj1ULbatY',
        nativeAmount: '123456780000'
      },
      'groestlcoin:3933BTHZdySDxk7PBqtPjARNfcj1ULbatY?amount=1234.5678'
    ],
    'address, amount, and label': [
      {
        publicAddress: '3933BTHZdySDxk7PBqtPjARNfcj1ULbatY',
        nativeAmount: '123456780000',
        currencyCode: 'GRS',
        metadata: {
          name: 'Johnny groestlcoin'
        }
      },
      'groestlcoin:3933BTHZdySDxk7PBqtPjARNfcj1ULbatY?amount=1234.5678&label=Johnny%20groestlcoin'
    ],
    'address, amount, label, & message': [
      {
        publicAddress: '3933BTHZdySDxk7PBqtPjARNfcj1ULbatY',
        nativeAmount: '123456780000',
        currencyCode: 'GRS',
        metadata: {
          name: 'Johnny groestlcoin',
          notes: 'Hello World, I miss you !'
        }
      },
      'groestlcoin:3933BTHZdySDxk7PBqtPjARNfcj1ULbatY?amount=1234.5678&label=Johnny%20groestlcoin&message=Hello%20World,%20I%20miss%20you%20!'
    ],
    'invalid currencyCode': [
      {
        publicAddress: '3933BTHZdySDxk7PBqtPjARNfcj1ULbatY',
        nativeAmount: '123456780000',
        currencyCode: 'INVALID',
        metadata: {
          name: 'Johnny groestlcoin',
          notes: 'Hello World, I miss you !'
        }
      }
    ]
  }
}
