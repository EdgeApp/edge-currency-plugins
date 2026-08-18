import { FixtureType, key, mnemonics } from '../common'

export const ecashcom: FixtureType = {
  pluginId: 'ecashcom',
  WALLET_TYPE: 'wallet:ecashcom',
  WALLET_FORMAT: 'bip32',
  'Test Currency code': 'ECX',
  key,
  // Identical to the bitcoin fixture's xpub, because ECX derives on Bitcoin's
  // coin type with Bitcoin's key prefixes:
  xpub:
    'xpub69FqMgncSEcrs989ejBWTBBcDNFDqkwEd7y53pVeXm8368TNfb9jCd2ne3ccpx9vvgBdpv79Edc69i2Q69kXtrdmLcQM8seffnCXzwzvWa6',
  'invalid key name': {
    id: 'unknown',
    type: 'wallet:ecashcom',
    keys: { ecashcomKeyz: '12345678abcd' }
  },
  'invalid wallet type': {
    id: 'unknown',
    type: 'shitcoin',
    keys: { ecashcomKeyz: '12345678abcd' }
  },
  importKey: {
    validKeys: [...mnemonics],
    invalidKeys: [
      ...mnemonics.map(mnemonic => mnemonic.split(' ').slice(1).join(' ')),
      'bunch of garbly gook !@#$%^&*()'
    ],
    unsupportedKeys: []
  },
  parseUri: {
    'address only': [
      '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        metadata: {}
      }
    ],
    'bech32 address only': [
      'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
      {
        publicAddress: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        metadata: {}
      }
    ],
    'uri address with amount': [
      'ecashcom:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1.23',
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        metadata: {},
        nativeAmount: '123000000',
        currencyCode: 'ECX'
      }
    ],
    // ECX and Bitcoin addresses are indistinguishable, so the URI scheme is
    // the only thing naming the chain and it must not be interchangeable:
    'bitcoin uri protocol rejected': [
      'bitcoin:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX'
    ]
  },
  encodeUri: {
    'address only': [
      { publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX' },
      '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX'
    ],
    'address & amount': [
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        nativeAmount: '123000000'
      },
      'ecashcom:1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX?amount=1.23'
    ],
    'invalid currencyCode': [
      {
        publicAddress: '1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX',
        nativeAmount: '123000000',
        currencyCode: 'INVALID'
      }
    ]
  }
}
