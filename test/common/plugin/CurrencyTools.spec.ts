import { assert } from 'chai'
import { makeFakeIo } from 'edge-core-js'

import { makeCurrencyTools } from '../../../src/common/plugin/CurrencyTools'
import { info as bitcoinInfo } from '../../../src/common/utxobased/info/bitcoin'
import { info as bitcoinCashInfo } from '../../../src/common/utxobased/info/bitcoincash'

describe('CurrencyTools', () => {
  const bitcoinTools = makeCurrencyTools(makeFakeIo(), bitcoinInfo)
  const bitcoinCashTools = makeCurrencyTools(makeFakeIo(), bitcoinCashInfo)

  it('returns modern Bitcoin public keys in derivation order', () => {
    const wrappedSegwit =
      'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP'
    const segwit =
      'zpub6qmK2GdQoxXphTU8DjQNBFc9xKc3XnoNBUhKHKfKchMmVLENqeVn8GcwL9ThKYme2Qqnvq8RSrJh2PkpPGhy5rXmizkRBZ7naCd33hHSpaN'

    const result = bitcoinTools.getDisplayPublicKeys?.({
      id: 'modern-bitcoin',
      type: 'wallet:bitcoin',
      keys: {
        publicKeys: {
          bip84: segwit,
          bip49: wrappedSegwit
        }
      }
    })

    assert.deepEqual(result, { bip49: wrappedSegwit, bip84: segwit })
    assert.deepEqual(Object.keys(result ?? {}), ['bip49', 'bip84'])
  })

  for (const format of ['bip32', 'bip44'] as const) {
    it(`returns a single ${format} key without renaming it`, () => {
      const legacy =
        'xpub6C7zQbq278xkqpJGb4Ewp9KSmJSdiqwYV45NCRDBLmgU9ighAuSsiDAicWm38ZXRUcYLnMEkH88tLF5ssfUMX3MtvrsgCmHYnmv2jHfev6z'

      const result = bitcoinCashTools.getDisplayPublicKeys?.({
        id: `legacy-${format}`,
        type: 'wallet:bitcoincash',
        keys: { publicKeys: { [format]: legacy } }
      })

      assert.deepEqual(result, { [format]: legacy })
    })
  }

  it('preserves valid bip32 and bip44 keys independently', async () => {
    const walletInfo = {
      id: 'multiple-legacy-keys',
      type: 'wallet:bitcoin',
      keys: {
        publicKeys: {
          bip32: 'airbitz-xpub',
          bip44: 'bip44-xpub'
        }
      }
    }

    assert.deepEqual(bitcoinTools.getDisplayPublicKeys?.(walletInfo), {
      bip32: 'airbitz-xpub',
      bip44: 'bip44-xpub'
    })
    assert.equal(
      await bitcoinTools.getDisplayPublicKey?.(walletInfo),
      'airbitz-xpub\nbip44-xpub'
    )
  })
})
