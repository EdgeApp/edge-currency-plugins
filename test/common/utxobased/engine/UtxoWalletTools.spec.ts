import { expect } from 'chai'

import { NetworkEnum } from '../../../../src/common/plugin/types'
import { makeUtxoWalletTools } from '../../../../src/common/utxobased/engine/makeUtxoWalletTools'
import { bitcoin } from '../../../../src/common/utxobased/info/all'

describe('wallet tools tests', () => {
  const walletTools = makeUtxoWalletTools({
    keys: {
      format: 'bip49',
      bitcoinKey:
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      coinType: 0,
      dataKey: 'uU0scsGxX1IWo4D4v8oB0T+caUrYibGwBjHrR5xeoK0=',
      syncKey: 'PFzlVyzztuA/QoSS/m9jHkvPv1s=',
      bitcoinXpub: {
        bip49:
          'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP'
      },
      bitcoinXpriv: {
        bip49:
          'yprvAHwhK6RbpuS3dgCYHM5jc2ZvEKd7Bi61u9FVhYMpgMSuZS613T1xxQeKTffhrHY79hZ5PsskBjcc6C2V7DrnsMsNaGDaWev3GLRQRgV7hxF'
      }
    },
    coinInfo: bitcoin.coinInfo,
    network: NetworkEnum.Mainnet
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
    keys: {
      wifKeys: ['L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr']
    },
    coinInfo: bitcoin.coinInfo,
    network: NetworkEnum.Mainnet
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
