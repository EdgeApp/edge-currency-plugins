import { expect } from 'chai'

import { NetworkEnum } from '../../../../src/common/plugin/types'
import { makeUtxoWalletTools } from '../../../../src/common/utxobased/engine/makeUtxoWalletTools'

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
    coin: 'bitcoin',
    network: NetworkEnum.Mainnet
  })

  it('Get Pubkey test', () => {
    const address = walletTools.getAddress({
      format: 'bip49',
      changeIndex: 0,
      addressIndex: 0
    })
    expect(address.address).to.eqls('37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf')
  })
  it('', () => {
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
