import { expect } from 'chai'
import { describe, it } from 'mocha'

import { all } from '../../../../src/common/utxobased/info/all'

describe('utxo currency info', () => {
  it('keeps the ecash.com fork distinct from the Bitcoin ABC eCash chain', () => {
    const ecash = all.find(info => info.currencyInfo.pluginId === 'ecash')
    const ecashcom = all.find(info => info.currencyInfo.pluginId === 'ecashcom')

    if (ecash == null || ecashcom == null)
      throw new Error('Missing eCash plugin info')

    expect(ecash.currencyInfo.currencyCode).to.equal('XEC')
    expect(ecashcom.currencyInfo.currencyCode).to.equal('ECX')
    expect(ecashcom.currencyInfo.displayName).to.not.equal(
      ecash.currencyInfo.displayName
    )

    // ECX shares Bitcoin's key space, which is what allows a Bitcoin wallet to
    // split into it and still see the forked coins:
    expect(ecashcom.coinInfo.coinType).to.equal(0)
    expect(ecashcom.coinInfo.prefixes.pubkeyHash).to.deep.equal([0x00])
    expect(ecashcom.coinInfo.prefixes.scriptHash).to.deep.equal([0x05])
    expect(ecashcom.coinInfo.prefixes.bech32).to.deep.equal(['bc'])
    expect(ecashcom.coinInfo.replayProtectionLocktime).to.equal(499999999)
  })

  it('has unique plugin IDs and wallet types', () => {
    const pluginIds = all.map(info => info.currencyInfo.pluginId)
    const walletTypes = all.map(info => info.currencyInfo.walletType)

    expect(new Set(pluginIds).size).to.equal(pluginIds.length)
    expect(new Set(walletTypes).size).to.equal(walletTypes.length)
  })
})
