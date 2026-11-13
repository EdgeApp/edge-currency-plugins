import { Transaction } from 'altcoin-js'

import { PluginInfo } from '../../../plugin/types'
import { DataLayer } from '../../db/DataLayer'
import { AddressData, TransactionData, UtxoData } from '../../db/types'
import {
  BIP43PurposeTypeEnum,
  CannotVerifyInputError,
  ScriptTypeEnum,
  verifyInputSignature
} from '../../keymanager/keymanager'
import { getScriptTypeFromPurposeType, pathToPurposeType } from '../utils'
import { UtxoWalletTools } from '../UtxoWalletTools'

type StoredInput = TransactionData['inputs'][number]

/**
 * - `none`: no input belongs to this wallet, so there is nothing to verify.
 * - `valid`: every wallet-owned input carries a signature from its key over
 *   this transaction, and the stored inputs/outputs match the hex.
 * - `invalid`: the transaction spends from this wallet but a signature is
 *   missing or wrong, or the stored data disagrees with the hex.
 * - `unsupported`: the transaction could not be judged (hex absent or not
 *   parseable, a script type or coin the verifier does not handle, a legacy
 *   input whose previous transaction is not on hand, or a signature that is
 *   the wallet's own but does not commit to the whole transaction).
 */
export type OwnInputSignatureStatus =
  | 'none'
  | 'valid'
  | 'invalid'
  | 'unsupported'

export type VerifyOwnInputSignaturesResult =
  | { status: 'none' }
  | {
      status: 'valid'
      /**
       * The value of each wallet-owned input, keyed by input index, as
       * proven by its signature (segwit) or by the previous transaction
       * (legacy). The stored `amount` and `fees` are reported values and
       * are not proven by anything.
       */
      ownInputValues: Map<number, number>
    }
  | { status: 'invalid' | 'unsupported'; reason: string }

export interface VerifyOwnInputSignaturesArgs {
  dataLayer: DataLayer
  pluginInfo: PluginInfo
  walletTools: UtxoWalletTools
  tx: TransactionData
}

const ZERO_TXID = '0'.repeat(64)

/**
 * The engine stores transactions as they are reported during sync. Before it
 * builds on one of those records (RBF acceleration rebuilds the spend from
 * the stored inputs and outputs), it checks that the record is a transaction
 * this wallet signed: for every input the wallet owns, the transaction hex
 * must carry a signature from that input's key over this exact transaction,
 * and the stored inputs and outputs must be the ones in the hex.
 */
export const verifyOwnInputSignatures = async (
  args: VerifyOwnInputSignaturesArgs
): Promise<VerifyOwnInputSignaturesResult> => {
  const { dataLayer, pluginInfo, walletTools, tx } = args
  const { coinInfo, engineInfo } = pluginInfo

  // Which inputs are ours? Decide from our own tables: the address recorded
  // for the input, or the outpoint itself if it is a UTXO we hold.
  // One read of the UTXO table serves this check and the signature check
  // below (an empty id list would fetch the whole table, hence the guard):
  const outpointOf = (input: StoredInput): string =>
    `${input.txId}_${input.outputIndex}`
  const utxosByOutpoint = new Map<string, UtxoData>()
  if (tx.inputs.length > 0) {
    const utxos = await dataLayer.fetchUtxos({
      utxoIds: tx.inputs.map(outpointOf)
    })
    for (const utxo of utxos) {
      if (utxo != null) utxosByOutpoint.set(utxo.id, utxo)
    }
  }
  const ownInputs: Array<{
    input: StoredInput
    address: AddressData
    utxo?: UtxoData
  }> = []
  for (const input of tx.inputs) {
    if (input.txId === ZERO_TXID) continue // coinbase or private spend
    const utxo = utxosByOutpoint.get(outpointOf(input))
    let address = await dataLayer.fetchAddress(input.scriptPubkey)
    if (address?.path == null) {
      if (utxo == null) continue
      address = await dataLayer.fetchAddress(utxo.scriptPubkey)
    }
    if (address?.path == null) continue
    ownInputs.push({ input, address, utxo })
  }
  if (ownInputs.length === 0) return { status: 'none' }

  if (tx.hex === '') {
    return { status: 'unsupported', reason: 'transaction hex is missing' }
  }
  let parsed: Transaction
  try {
    parsed = Transaction.fromHex(tx.hex)
  } catch (error) {
    return {
      status: 'unsupported',
      reason: `transaction hex is not parseable: ${String(error)}`
    }
  }

  // The hex must be the transaction it claims to be:
  const parsedTxid = parsed.getId(coinInfo.txHashFunction)
  if (parsedTxid !== tx.txid) {
    return {
      status: 'invalid',
      reason: `hex hashes to ${parsedTxid}, not ${tx.txid}`
    }
  }

  // ...and the stored inputs and outputs must be the ones in the hex, since
  // callers rebuild spends from the stored data. Each stored entry must also
  // name a distinct index: the count check alone would let an output listed
  // twice stand in for the change, and acceleration pays every stored output.
  const inputIndexes = new Set<number>()
  const outputIndexes = new Set<number>()
  if (parsed.ins.length !== tx.inputs.length) {
    return { status: 'invalid', reason: 'input count differs from hex' }
  }
  for (const input of tx.inputs) {
    const parsedInput = parsed.ins[input.n]
    if (parsedInput == null) {
      return { status: 'invalid', reason: `input ${input.n} is not in hex` }
    }
    if (inputIndexes.has(input.n)) {
      return { status: 'invalid', reason: `input ${input.n} is listed twice` }
    }
    inputIndexes.add(input.n)
    const parsedTxid = Buffer.from(parsedInput.hash).reverse().toString('hex')
    if (
      parsedTxid !== input.txId ||
      parsedInput.index !== input.outputIndex ||
      parsedInput.sequence !== input.sequence
    ) {
      return {
        status: 'invalid',
        reason: `input ${input.n} differs from hex`
      }
    }
  }
  if (parsed.outs.length !== tx.outputs.length) {
    return { status: 'invalid', reason: 'output count differs from hex' }
  }
  for (const output of tx.outputs) {
    const parsedOutput = parsed.outs[output.n]
    if (parsedOutput == null) {
      return { status: 'invalid', reason: `output ${output.n} is not in hex` }
    }
    if (outputIndexes.has(output.n)) {
      return {
        status: 'invalid',
        reason: `output ${output.n} is listed twice`
      }
    }
    outputIndexes.add(output.n)
    const parsedScript = parsedOutput.script.toString('hex')
    // 'unknown' is what the engine stores for a script it could not derive
    // from the reported address. Its value is still checked here, and callers
    // that rebuild the output take its script from the hex, not the record.
    if (
      String(parsedOutput.value) !== output.amount ||
      (output.scriptPubkey !== 'unknown' &&
        output.scriptPubkey !== parsedScript)
    ) {
      return {
        status: 'invalid',
        reason: `output ${output.n} differs from hex`
      }
    }
  }

  // Finally, the signatures:
  const ownInputValues = new Map<number, number>()
  for (const { input, address, utxo } of ownInputs) {
    // The stored list is in whatever order it was reported, so the input is
    // identified by its own index, never by its position in that list:
    const index = input.n
    const { path } = address
    if (path == null) continue // narrowed above; keeps the type checker happy
    const purposeType = pathToPurposeType(path, engineInfo.scriptTemplates)
    if (purposeType === BIP43PurposeTypeEnum.ReplayProtection) {
      return {
        status: 'unsupported',
        reason: `input ${index} uses a replay-protection script`
      }
    }
    const scriptType = getScriptTypeFromPurposeType(purposeType)
    const pubkey = walletTools.getPubkey(path)
    // The previous transaction paid this wallet, so it is normally in the
    // transaction table even when the UTXO record is already gone:
    const [prevTx] = await dataLayer.fetchTransactions({ txId: input.txId })
    // The value of the spent output: what we recorded for the UTXO, else what
    // the stored previous transaction says, else the reported amount (which
    // is 0 when the report leaves it out). A wrong value cannot make a
    // signature pass; it can only make a genuine segwit one fail.
    const value = parseInt(
      utxo?.value ??
        prevTx?.outputs.find(output => output.n === input.outputIndex)
          ?.amount ??
        input.amount
    )
    if (!Number.isFinite(value)) {
      return { status: 'invalid', reason: `input ${index} has no value` }
    }
    // A legacy input is verified against the previous transaction itself,
    // which the engine also keeps as a legacy UTXO's script:
    let prevTxHex: string | undefined
    if (scriptType === ScriptTypeEnum.p2pkh) {
      prevTxHex =
        utxo?.scriptType === ScriptTypeEnum.p2pkh ? utxo.script : prevTx?.hex
    }

    let ok: boolean
    try {
      ok = verifyInputSignature({
        tx: parsed,
        inputIndex: index,
        pubkey,
        scriptType,
        value,
        prevTxHex,
        coin: coinInfo.name
      })
    } catch (error) {
      if (error instanceof CannotVerifyInputError) {
        return { status: 'unsupported', reason: error.message }
      }
      throw error
    }
    if (!ok) {
      return {
        status: 'invalid',
        reason: `input ${index} is not signed by this wallet`
      }
    }
    // A segwit signature commits to the value it was given. A legacy one
    // does not, but the verifier checked the previous transaction against
    // the outpoint, so its output carries the real value:
    ownInputValues.set(
      index,
      prevTxHex != null
        ? Transaction.fromHex(prevTxHex).outs[input.outputIndex].value
        : value
    )
  }

  return { status: 'valid', ownInputValues }
}
