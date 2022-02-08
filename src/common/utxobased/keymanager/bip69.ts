/***
 * https://github.com/bitcoin/bips/blob/master/bip-0069.mediawiki
 */

import { Input, Output } from './utxopicker'

/***
 * Previous transaction hashes (in reversed byte-order) are to be sorted in ascending order, lexicographically.
 * In the event of two matching transaction hashes,
 * the respective previous output indices will be compared by their integer value, in ascending order.
 * If the previous output indices match, the inputs are considered equal.
 */
export const sortInputs = (inputs: Input[]): Input[] =>
  [...inputs].sort((a, b) => {
    const aHash = Buffer.from(a.hash).reverse()
    const bHash = Buffer.from(b.hash).reverse()
    const compare = aHash.compare(bHash)
    return compare !== 0 ? compare : a.index - b.index
  })

/***
 * Transaction output amounts (as 64-bit unsigned integers) are to be sorted in ascending order.
 * In the event of two matching output amounts,
 * the respective output scriptPubKeys (as a byte-array) will be compared lexicographically, in ascending order.
 * If the scriptPubKeys match, the outputs are considered equal.
 * If the previous output indices match, the inputs are considered equal.
 */
export const sortOutputs = (outputs: Output[]): Output[] =>
  [...outputs].sort((a, b) =>
    a.value === b.value ? a.script.compare(b.script) : a.value - b.value
  )
