import { setDefaultTrailerPolicy } from 'altcoin-js'

/**
 * PIVX appends its own structures after the locktime, which vanilla parsing
 * rejects as unexpected data. Its serialization is, from
 * `PIVX/src/primitives/transaction.h`:
 *
 *     int16_t nVersion, int16_t nType, vin, vout, uint32_t nLockTime,
 *     Optional<SaplingTxData> sapData, Optional<vector<uint8_t>> extraPayload
 *
 * `sapData` is present when `nVersion >= 3` (Sapling), and `extraPayload`
 * additionally when `nType != 0`. Everything after the locktime is preserved
 * verbatim so the transaction re-serializes byte-identically.
 *
 * Two consequences of `nVersion` and `nType` each being 16 bits, where
 * altcoin-js reads a single 32-bit version:
 *
 *  - The version it sees is `nType << 16 | nVersion`, so a PIVX *special*
 *    transaction (`nType != 0`) reads as 65539 rather than 3. Masking off the
 *    low 16 bits is what makes those parse; matching on `=== 3` alone does not.
 *  - Segwit detection needs no special case. The byte after the version is the
 *    input count, which is never zero, so the marker check fails on its own.
 *    Disabling witness parsing for version 3 outright — as a narrower reading
 *    of this format might suggest — would break Bitcoin's own version 3 TRUC
 *    transactions, which are segwit and live on mainnet.
 *
 * This is process-wide because transactions are also parsed where no coin
 * context is available, notably a PSBT input's `nonWitnessUtxo`. That is safe
 * for every other coin: a well-formed transaction has nothing after its
 * locktime, so the trailer branch never runs.
 */
export const installTrailerPolicy = (): void => {
  setDefaultTrailerPolicy({
    allowsWitness: () => true,
    preservesTrailer: version => (version & 0xffff) >= 3
  })
}
