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
  const wifKey = 'L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr'
  const walletTools = makeUtxoWalletTools({
    publicKey: {} as any,
    coin: 'bitcoin'
  })

  it('can get scriptPubkey from WIF', () => {
    const fixtures = [
      ['bip32', '76a9148bbc95d2709c71607c60ee3f097c1217482f518d88ac'],
      ['bip44', '76a9148bbc95d2709c71607c60ee3f097c1217482f518d88ac'],
      ['bip49', 'a9142427d83a84e5793ce6f6efc33020d844dd217dbb87'],
      ['bip84', '00148bbc95d2709c71607c60ee3f097c1217482f518d']
    ] as const
    for (const [format, expectation] of fixtures) {
      const { scriptPubkey } = walletTools.getScriptPubkeyFromWif(
        wifKey,
        format
      )
      expect(scriptPubkey).to.equal(expectation)
    }
  })
  it('can get address from wif', () => {
    const fixtures = [
      ['bip32', '1DjrqoDMoDaMKjVi4mNZXxoiE5Wk9iU9eZ'],
      ['bip49', '34zByuPDqZFhPdiG1ADZSvjmbnpMyG8sRQ'],
      ['bip49', '34zByuPDqZFhPdiG1ADZSvjmbnpMyG8sRQ'],
      ['bip84', 'bc1q3w7ft5nsn3ckqlrqaclsjlqjzayz75vdw26z2s']
    ] as const
    for (const [format, expectation] of fixtures) {
      const { scriptPubkey } = walletTools.getScriptPubkeyFromWif(
        wifKey,
        format
      )
      const address = walletTools.scriptPubkeyToAddress({
        scriptPubkey,
        format
      })
      expect(address.legacyAddress).to.equal(expectation)
    }
  })
  it('can get private key from wif', () => {
    const privateKey = walletTools.getPrivateKeyFromWif(wifKey)
    expect(privateKey).to.equal(
      'a99962febe363fa89fdef8aac28a19194670465548e732d3f866df3c5fc49248'
    )
  })
})
