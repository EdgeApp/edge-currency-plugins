import { FixtureType, key } from '../common'

export const digibyte: FixtureType = {
  pluginId: 'digibyte',
  WALLET_TYPE: 'wallet:digibyte',
  WALLET_FORMAT: 'bip44',
  'Test Currency code': 'DGB',
  key,
  xpub:
    'xpub6D3ViKs81upgt2wCPw6DAxShnF3LDGEbS2Xdgu2ippxMucCaxFkLErfXCxJYreDwB4oAURkMtoB9zCj5JvRJgsz2gE2Xx7s1pCZtYUnmJYn',
  'invalid key name': {
    id: 'unknown',
    type: 'wallet:digibyte',
    keys: {
      digibyteKeyz: '12345678abcd',
      format: 'bip44'
    }
  },
  'invalid wallet type': {
    id: 'unknown',
    type: 'shitcoin',
    keys: { digibyteKeyz: '12345678abcd' }
  },
  parseUri: {
    'address only': [
      'DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms',
      {
        publicAddress: 'DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms',
        metadata: {}
      }
    ],
    'address only2': [
      'Sfbt8PhCtE9tAaSD4rZhnB1BT1w8iDnWBt',
      {
        publicAddress: 'Sfbt8PhCtE9tAaSD4rZhnB1BT1w8iDnWBt',
        metadata: {}
      }
    ],
    'address only3': [
      'dgb1qnjf7e2a5ezft480kxzmhgg66pnzqk0aawxa06u',
      {
        publicAddress: 'dgb1qnjf7e2a5ezft480kxzmhgg66pnzqk0aawxa06u',
        metadata: {}
      }
    ],
    'uri address': [
      'digibyte:DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms',
      {
        publicAddress: 'DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms',
        metadata: {}
      }
    ],
    'uri address with amount': [
      'digibyte:DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms?amount=12345.6789',
      {
        publicAddress: 'DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'DGB'
      }
    ],
    'uri address with amount & label': [
      'digibyte:DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms?amount=1234.56789&label=Johnny%20Digibyte',
      {
        publicAddress: 'DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms',
        metadata: {
          name: 'Johnny Digibyte'
        },
        nativeAmount: '123456789000',
        currencyCode: 'DGB'
      }
    ],
    'uri address with amount, label & message': [
      'digibyte:DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms?amount=1234.56789&label=Johnny%20Digibyte&message=Hello%20World,%20I%20miss%20you%20!',
      {
        publicAddress: 'DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms',
        metadata: {
          name: 'Johnny Digibyte',
          notes: 'Hello World, I miss you !'
        },
        nativeAmount: '123456789000',
        currencyCode: 'DGB'
      }
    ],
    'uri address with unsupported param': [
      'digibyte:DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms?unsupported=helloworld&amount=12345.6789',
      {
        publicAddress: 'DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms',
        metadata: {},
        nativeAmount: '1234567890000',
        currencyCode: 'DGB'
      }
    ],
    'wif 1 - Compressed': [
      'KzAwX4sqvmrvuUtSEwBq93CcTHLFqXKK5mYf1JwYzgnATrYLeGEz',
      {
        metadata: {},
        privateKeys: ['KzAwX4sqvmrvuUtSEwBq93CcTHLFqXKK5mYf1JwYzgnATrYLeGEz']
      }
    ],
    'wif 2 - Compressed': [
      'L2yNtAC2GC4PpxmPi1xHHvWFGuXuST9ECsdehH8FuXfVqAj1DdVs',
      {
        metadata: {},
        privateKeys: ['L2yNtAC2GC4PpxmPi1xHHvWFGuXuST9ECsdehH8FuXfVqAj1DdVs']
      }
    ],
    'wif 3 - Compressed': [
      'L5Xn1K6XobLbBFhLgxj6yEzMecZmmUDHwY9izkPx4kfYTSWcHcGd',
      {
        metadata: {},
        privateKeys: ['L5Xn1K6XobLbBFhLgxj6yEzMecZmmUDHwY9izkPx4kfYTSWcHcGd']
      }
    ],
    'wif 4 - Non Compressed': [
      '5JQsweUVF7V243N2qmoJtDjGqhXqPcwViWG961P1hsrAoMsNAnQ',
      {
        metadata: {},
        privateKeys: ['5JQsweUVF7V243N2qmoJtDjGqhXqPcwViWG961P1hsrAoMsNAnQ']
      }
    ],
    'wif 5 - Non Compressed': [
      '5J367GdKAsPTKunGfiv5ZWZRxq9N2a8BHoXhsuT5FZLadsF7Tif',
      {
        metadata: {},
        privateKeys: ['5J367GdKAsPTKunGfiv5ZWZRxq9N2a8BHoXhsuT5FZLadsF7Tif']
      }
    ],
    'wif 1 - Old - Compressed': [
      'QRZrfugqBPM491HUqD2d2G3DvKMpt5T7y2EZnwLPj3PWunVUAzBS',
      {
        metadata: {},
        privateKeys: ['QRZrfugqBPM491HUqD2d2G3DvKMpt5T7y2EZnwLPj3PWunVUAzBS']
      }
    ],
    'wif 2 - Old - Compressed': [
      'QUNJ3111WoYX4VASJHo5B9LrjwZUV1H368KZUuX6dtGrH6hoCD3z',
      {
        metadata: {},
        privateKeys: ['QUNJ3111WoYX4VASJHo5B9LrjwZUV1H368KZUuX6dtGrH6hoCD3z']
      }
    ],
    'wif 3 - Old - Compressed': [
      'QWvhA9uX4CpiQn6PHEZtrTpy7ebLp2M6pnqdnNnno7GtuNTnRzgP',
      {
        metadata: {},
        privateKeys: ['QWvhA9uX4CpiQn6PHEZtrTpy7ebLp2M6pnqdnNnno7GtuNTnRzgP']
      }
    ],
    'wif 4 - Old - Non Compressed': [
      '6JjDEbwSosmp6eoC3ARHVqiWK81NtkDmKgPNQW1uXY3oc32GfX7',
      {
        metadata: {},
        privateKeys: ['6JjDEbwSosmp6eoC3ARHVqiWK81NtkDmKgPNQW1uXY3oc32GfX7']
      }
    ],
    'wif 5 - Old - Non Compressed': [
      '6JMRQE6GjdgFNXDRs7Y4B8YfSFcuXhQStyewCQ5y5DYDSWuVdTB',
      {
        metadata: {},
        privateKeys: ['6JMRQE6GjdgFNXDRs7Y4B8YfSFcuXhQStyewCQ5y5DYDSWuVdTB']
      }
    ]
  },
  encodeUri: {
    'address only': [
      { publicAddress: 'DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms' },
      'DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms'
    ],
    // TODO: Remove this if we determine that it's valid to call encodeUri
    // without the expected `publicAddress` param.
    // 'legacy address1': [
    //   { legacyAddress: 'DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms' },
    //   'DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms'
    // ],
    'address & amount': [
      {
        publicAddress: 'DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms',
        nativeAmount: '123456780000'
      },
      'digibyte:DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms?amount=1234.5678'
    ],
    'address, amount, and label': [
      {
        publicAddress: 'DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms',
        nativeAmount: '123456780000',
        currencyCode: 'DGB',
        metadata: {
          name: 'Johnny Digibyte'
        }
      },
      'digibyte:DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms?amount=1234.5678&label=Johnny%20Digibyte'
    ],
    'address, amount, label, & message': [
      {
        publicAddress: 'DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms',
        nativeAmount: '123456780000',
        currencyCode: 'DGB',
        metadata: {
          name: 'Johnny Digibyte',
          notes: 'Hello World, I miss you !'
        }
      },
      'digibyte:DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms?amount=1234.5678&label=Johnny%20Digibyte&message=Hello%20World,%20I%20miss%20you%20!'
    ],
    'invalid currencyCode': [
      {
        publicAddress: 'DBxwAPhdnNsht2reoZzmu5wiV4S8hzgoms',
        nativeAmount: '123456780000',
        currencyCode: 'INVALID',
        metadata: {
          name: 'Johnny Digibyte',
          notes: 'Hello World, I miss you !'
        }
      }
    ]
  }
}
