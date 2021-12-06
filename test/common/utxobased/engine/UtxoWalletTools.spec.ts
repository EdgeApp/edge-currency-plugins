import { expect } from 'chai'

import { makeUtxoWalletTools } from '../../../../src/common/utxobased/engine/makeUtxoWalletTools'

describe('wallet tools tests', () => {
  const walletTools = makeUtxoWalletTools({
    publicKey: {
      publicKeys: {
        bip49:
          'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP',
        bip84:
          'zpub6qmK2GdQoxXphTU8DjQNBFc9xKc3XnoNBUhKHKfKchMmVLENqeVn8GcwL9ThKYme2Qqnvq8RSrJh2PkpPGhy5rXmizkRBZ7naCd33hHSpaN'
      }
    },
    coin: 'bitcoin'
  })

  it('Get Address test', () => {
    const address = walletTools.getAddress({
      format: 'bip49',
      changeIndex: 0,
      addressIndex: 0
    })
    expect(address.address).to.eqls('37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf')
  })
  it('Get ScriptPubkey test', () => {
    const scriptPubkey = walletTools.getScriptPubkey({
      format: 'bip49',
      changeIndex: 0,
      addressIndex: 0
    })
    expect(scriptPubkey.scriptPubkey).to.eqls(
      'a9143fb6e95812e57bb4691f9a4a628862a61a4f769b87'
    )
  })
})

describe('wallet tools wif test', () => {
  const walletTools = makeUtxoWalletTools({
    publicKey: {} as any,
    wifKeys: ['L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr'],
    coin: 'bitcoin'
  })

  it('Get Address test', () => {
    const address = walletTools.getAddress({
      format: 'bip32',
      changeIndex: 0,
      addressIndex: 0
    })
    expect(address.legacyAddress).to.eqls('1DjrqoDMoDaMKjVi4mNZXxoiE5Wk9iU9eZ')
  })
  it('Get ScriptPubkey test', () => {
    const scriptPubkey = walletTools.getScriptPubkey({
      format: 'bip49',
      changeIndex: 0,
      addressIndex: 0
    })
    expect(scriptPubkey.scriptPubkey).to.eqls(
      'a9142427d83a84e5793ce6f6efc33020d844dd217dbb87'
    )
  })
  it('Get Address fail', () => {
    expect(() =>
      walletTools.getAddress({
        format: 'bip32',
        changeIndex: 0,
        addressIndex: 1
      })
    ).to.throw()
    // expect(address.legacyAddress).to.eqls('lol!')
  })
})
