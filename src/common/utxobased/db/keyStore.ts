import { EdgeTxDatabase } from 'edge-core-js/types'

import { CurrencyFormat } from '../../plugin/types'
import { CurrencyFormatKeys, deriveXprivFromKeys } from '../engine/utils'
import { PrivateKey } from '../keymanager/cleaners'

/**
 * The wallet's extended private keys, one row per format.
 *
 * Deriving them from the seed is slow enough to be worth doing once, so they
 * are kept -- in the `keys` table, in the account database, which is
 * encrypted at rest like the encrypted disklet they used to live in.
 */

interface KeyRow {
  format: CurrencyFormat
  xpriv: string
}

export const fetchOrDeriveXprivFromKeys = async (args: {
  privateKey: PrivateKey
  txDatabase: EdgeTxDatabase
  coin: string
}): Promise<CurrencyFormatKeys> => {
  const { txDatabase } = args

  const rows = (await txDatabase.findRows('keys', {})) as KeyRow[]
  if (rows.length > 0) {
    const keys: CurrencyFormatKeys = {}
    for (const row of rows) keys[row.format] = row.xpriv
    return keys
  }

  const keys = deriveXprivFromKeys(args)
  const derived: KeyRow[] = []
  for (const format of Object.keys(keys) as CurrencyFormat[]) {
    const xpriv = keys[format]
    if (xpriv != null) derived.push({ format, xpriv })
  }
  // Two calls racing both derive the same keys; the second write is a no-op:
  await txDatabase.putRowsIfAbsent([{ table: 'keys', rows: derived }])
  return keys
}
