// @flow

import { assert } from 'chai'
import { describe, it } from 'mocha'

import { parsePathname } from '../../../../../src/common/utxobased/engine/utils'
import {
  toNewFormat,
  verifyAddress,
  VerifyAddressEnum
} from '../../../../../src/common/utxobased/keymanager/keymanager'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import plugins from '../../../../../src/index'
import fixtures from './fixtures.json'

for (const fixture of fixtures) {
  const { network } = fixture

  describe(`Address format for ${network}`, function () {
    fixture.valid.forEach(address => {
      it(`test valid for ${address}`, function () {
        assert.equal(
          verifyAddress({ address, coin: network }),
          VerifyAddressEnum.good
        )
        assert.equal(
          parsePathname({ pathname: address, coin: network }).publicAddress,
          toNewFormat(address, network)
        )
      })
    })

    fixture.invalid.forEach(address => {
      it(`test invalid for ${address}`, function () {
        assert.equal(
          verifyAddress({ address, coin: network }),
          VerifyAddressEnum.bad
        )
        assert.throws(
          () => parsePathname({ pathname: address, coin: network }),
          'InvalidPublicAddressError'
        )
      })
    })

    fixture.toLegacy.forEach(([address, _legacy]) => {
      it(`get legacy format for ${address}`, function () {
        assert.equal(
          verifyAddress({ address, coin: network }),
          VerifyAddressEnum.good
        )
        assert.deepEqual(parsePathname({ pathname: address, coin: network }), {
          // Uncomment this line if/when we change to always include legacy addresses
          // legacyAddress: _legacy,
          publicAddress: toNewFormat(address, network)
        })
      })
    })

    fixture.toNewFormat.forEach(([legacy, address]) => {
      it(`get new format for ${legacy}`, function () {
        assert.equal(
          verifyAddress({ address: legacy, coin: network }),
          VerifyAddressEnum.legacy
        )
        assert.deepEqual(parsePathname({ pathname: legacy, coin: network }), {
          legacyAddress: legacy,
          publicAddress: toNewFormat(address, network)
        })
      })
    })
  })
}
