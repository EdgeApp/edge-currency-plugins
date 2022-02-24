import { airbitzSeeds, FixtureType, key, mnemonics } from '../common'

export const zcoin: FixtureType = {
  pluginId: 'zcoin',
  WALLET_TYPE: 'wallet:zcoin',
  WALLET_FORMAT: 'bip44',
  'Test Currency code': 'FIRO',
  key,
  xpub:
    'xpub6CnGSFBso9rc7NwJxH7TAk27uThysAfy7AtFZpZeMYonpyFrYVXPWzp1gpZGKmtFC4LV2Gmeui3q1d419WRah4NNH7Et1T3o61JgmPH5iwJ',
  'invalid key name': {
    id: 'unknown',
    type: 'wallet:zcoin',
    keys: {
      zcoinKeyz: '12345678abcd',
      format: 'bip44'
    }
  },
  'invalid wallet type': {
    id: 'unknown',
    type: 'shitcoin',
    keys: { zcoinKeyz: '12345678abcd' }
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
      'aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty',
      {
        publicAddress: 'aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty',
        metadata: {}
      }
    ],
    'address only2': [
      'ZzyfJFVqCWnzEXCDTUyhaseLW7GzCq9sA1',
      {
        publicAddress: 'ZzyfJFVqCWnzEXCDTUyhaseLW7GzCq9sA1',
        metadata: {}
      }
    ],
    'uri address': [
      'zcoin:aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty',
      {
        publicAddress: 'aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty',
        metadata: {}
      }
    ],
    'uri address with amount': [
      'zcoin:aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty?amount=12345.6789',
      {
        publicAddress: 'aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'FIRO'
      }
    ],
    'uri address with amount & label': [
      'firo:aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty?amount=1234.56789&label=Johnny%20Zcoin',
      {
        publicAddress: 'aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty',
        metadata: {
          name: 'Johnny Zcoin'
        },
        nativeAmount: '123456789000',
        currencyCode: 'FIRO'
      }
    ],
    'uri address with amount, label & message': [
      'firo:aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty?amount=1234.56789&label=Johnny%20Zcoin&message=Hello%20World,%20I%20miss%20you%20!',
      {
        publicAddress: 'aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty',
        metadata: {
          name: 'Johnny Zcoin',
          notes: 'Hello World, I miss you !'
        },
        nativeAmount: '123456789000',
        currencyCode: 'FIRO'
      }
    ],
    'uri address with unsupported param': [
      'zcoin:aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty?unsupported=helloworld&amount=12345.6789',
      {
        publicAddress: 'aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'FIRO'
      }
    ],
    'wif 1 - Compressed': [
      'YBHu5hraCFjDhXqGoWDzC8hZ9TfKaCe4VQU4nSuTPqRM1n8Nwvu4',
      {
        metadata: {},
        privateKeys: ['YBHu5hraCFjDhXqGoWDzC8hZ9TfKaCe4VQU4nSuTPqRM1n8Nwvu4']
      }
    ],
    'wif 2 - Compressed': [
      'YBfH26UnzrLqkosKnERVUg9xgxueanZbjiiZEMCrNQbiBeKe7mDW',
      {
        metadata: {},
        privateKeys: ['YBfH26UnzrLqkosKnERVUg9xgxueanZbjiiZEMCrNQbiBeKe7mDW']
      }
    ],
    'wif 3 - Compressed': [
      'YCH6gkpCwGmUb7uG1HMjLrPh3K8gT4wmwtzPyNwysJSekncHqRxG',
      {
        metadata: {},
        privateKeys: ['YCH6gkpCwGmUb7uG1HMjLrPh3K8gT4wmwtzPyNwysJSekncHqRxG']
      }
    ],
    'wif 1 - Non Compressed': [
      '83FPakvmYu5GD8v3GzXQmbLRef9WpnuCU7hnkMqdMo8fFSG6TX6',
      {
        metadata: {},
        privateKeys: ['83FPakvmYu5GD8v3GzXQmbLRef9WpnuCU7hnkMqdMo8fFSG6TX6']
      }
    ],
    'wif 2 - Non Compressed': [
      '84hKkFAhnsnaJiAhceBynC2ZsZegSRXmeaPh7mwtwsTtFWi5xAs',
      {
        metadata: {},
        privateKeys: ['84hKkFAhnsnaJiAhceBynC2ZsZegSRXmeaPh7mwtwsTtFWi5xAs']
      }
    ],
    'wif 3 - Non Compressed': [
      '83nie713kHUxvPUMzbTXvU7NDA45nK9nQ34PPqmibSumzbqmopG',
      {
        metadata: {},
        privateKeys: ['83nie713kHUxvPUMzbTXvU7NDA45nK9nQ34PPqmibSumzbqmopG']
      }
    ]
  },
  encodeUri: {
    'address only': [
      { publicAddress: 'aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty' },
      'aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty'
    ],
    'legacy address1': [
      { publicAddress: 'ZzyfJFVqCWnzEXCDTUyhaseLW7GzCq9sA1' },
      'ZzyfJFVqCWnzEXCDTUyhaseLW7GzCq9sA1'
    ],
    'legacy address2': [
      { publicAddress: 'aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty' },
      'aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty'
    ],
    'legacy address3': [
      { publicAddress: 'a5ozVQfAhdbctoyi6scufVWNp3gSvmVchf' },
      'a5ozVQfAhdbctoyi6scufVWNp3gSvmVchf'
    ],
    'new format address': [
      { publicAddress: 'ZzyfJFVqCWnzEXCDTUyhaseLW7GzCq9sA1' },
      'ZzyfJFVqCWnzEXCDTUyhaseLW7GzCq9sA1'
    ],
    'address & amount': [
      {
        publicAddress: 'aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty',
        nativeAmount: '123456780000'
      },
      'firo:aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty?amount=1234.5678'
    ],
    'address, amount, and label': [
      {
        publicAddress: 'aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty',
        nativeAmount: '123456780000',
        currencyCode: 'FIRO',
        metadata: {
          name: 'Johnny Zcoin'
        }
      },
      'firo:aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty?amount=1234.5678&label=Johnny%20Zcoin'
    ],
    'address, amount, label, & message': [
      {
        publicAddress: 'aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty',
        nativeAmount: '123456780000',
        currencyCode: 'FIRO',
        metadata: {
          name: 'Johnny Zcoin',
          notes: 'Hello World, I miss you !'
        }
      },
      'firo:aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty?amount=1234.5678&label=Johnny%20Zcoin&message=Hello%20World,%20I%20miss%20you%20!'
    ],
    'invalid currencyCode': [
      {
        publicAddress: 'aL1aoLHKm8LiDT7vYRRnNgY5EhnapiJaty',
        nativeAmount: '123456780000',
        currencyCode: 'INVALID',
        metadata: {
          name: 'Johnny Zcoin',
          notes: 'Hello World, I miss you !'
        }
      }
    ]
  }
}
