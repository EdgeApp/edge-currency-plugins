import { expect } from 'chai'
import { describe, it } from 'mocha'

import { inferPrivateKeyFormat } from '../src/common/utxobased/keymanager/cleaners'

describe('inferPrivateKeyFormat', function () {
  it('returns bip49 when only bip84 zpub is present', function () {
    expect(
      inferPrivateKeyFormat({
        publicKeys: { bip84: 'zpubOnly' }
      })
    ).equals('bip49')
  })

  it('returns bip49 when bip49 and bip84 are present', function () {
    expect(
      inferPrivateKeyFormat({
        publicKeys: { bip49: 'ypub', bip84: 'zpub' }
      })
    ).equals('bip49')
  })

  it('returns bip44 for bip44-only', function () {
    expect(
      inferPrivateKeyFormat({
        publicKeys: { bip44: 'xpub' }
      })
    ).equals('bip44')
  })
})
