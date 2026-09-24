import { expect } from 'chai'
import { makeMemoryTxDatabase } from 'edge-core-js'
import { describe, it } from 'mocha'

import { dataLayerTables } from '../../../../src/common/utxobased/db/DataLayer'
import { fetchOrDeriveXprivFromKeys } from '../../../../src/common/utxobased/db/keyStore'
import { deriveXprivFromKeys } from '../../../../src/common/utxobased/engine/utils'
import { PrivateKey } from '../../../../src/common/utxobased/keymanager/cleaners'

/**
 * The xprivs, derived once and kept in the wallet's `keys` rows.
 */

const seedA =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const seedB = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong'

const privateKey = (seed: string): PrivateKey => ({
  coinType: 0,
  format: 'bip49',
  seed
})

describe('keyStore', function () {
  it('derives once, then reads the row', async function () {
    const txDatabase = await makeMemoryTxDatabase({
      walletId: Buffer.alloc(32, 0x33).toString('base64'),
      pluginId: 'bitcoin'
    })
    await txDatabase.defineTables(dataLayerTables)
    expect(await txDatabase.findRows('keys', {})).deep.equals([])

    const first = await fetchOrDeriveXprivFromKeys({
      privateKey: privateKey(seedA),
      txDatabase,
      coin: 'bitcoin'
    })
    // The same keys `walletKeys.json` held for this seed:
    expect(first).deep.equals(
      deriveXprivFromKeys({ privateKey: privateKey(seedA), coin: 'bitcoin' })
    )
    expect(Object.keys(first).sort((a, b) => a.localeCompare(b))).deep.equals([
      'bip49',
      'bip84'
    ])
    expect((await txDatabase.findRows('keys', {})).length).equals(2)

    // Read back, not derived: a different seed still gets the stored keys.
    const second = await fetchOrDeriveXprivFromKeys({
      privateKey: privateKey(seedB),
      txDatabase,
      coin: 'bitcoin'
    })
    expect(second).deep.equals(first)
  })
})
