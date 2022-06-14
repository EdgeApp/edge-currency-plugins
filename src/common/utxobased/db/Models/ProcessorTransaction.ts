import { EdgeTransaction } from 'edge-core-js/types'

import { PluginInfo } from '../../../plugin/types'
import { UTXOPluginWalletTools } from '../../engine/makeUtxoWalletTools'
import { UtxoTxOtherParams } from '../../engine/types'
import { defaultValidateConfirmations } from '../../engine/util/defaultValidateConfirmations'
import { isPathUsingDerivationLevelScriptHash } from '../../keymanager/keymanager'
import { Processor } from '../makeProcessor'
import { IProcessorTransaction } from '../types'

export const fromEdgeTransaction = (
  tx: EdgeTransaction
): IProcessorTransaction => {
  const otherParams = tx.otherParams as UtxoTxOtherParams
  if (otherParams == null) throw new Error('Invalid transaction data')
  if (otherParams.psbt == null)
    throw new Error('Missing PSBT in edge transaction data')

  /**
   * [1]: Buffer.from is necessary because Buffers are converted to Uint8Arrays
   * after through passing the bridge.
   */
  const inputs = otherParams.psbt.inputs.map((input, n) => ({
    amount: input.value.toString(),
    scriptPubkey: Buffer.from(input.scriptPubkey).toString('hex'), // [1]
    n,
    txId: Buffer.from(input.hash).reverse().toString('hex'), // [1]
    outputIndex: input.index
  }))
  const outputs = otherParams.psbt.outputs.map((output, n) => ({
    amount: output.value.toString(),
    scriptPubkey: Buffer.from(output.scriptPubkey).toString('hex'), // [1]
    n
  }))

  return {
    txid: tx.txid,
    hex: tx.signedTx,
    blockHeight: tx.blockHeight,
    date: tx.date,
    fees: tx.networkFee,
    inputs: inputs,
    outputs: outputs,
    // We can leave ourIns/ourOuts blank because they'll be updated by the
    // processor when receiving the transaction from blockbook.
    // We may want to calculate these preemptively, but for now this will work.
    ourIns: [],
    ourOuts: [],
    ourAmount: tx.nativeAmount ?? '0'
  }
}

interface ToEdgeTransactionArgs {
  tx: IProcessorTransaction
  currencyCode: string
  pluginInfo: PluginInfo
  processor: Processor
  walletBlockHeight: number
  walletTools: UTXOPluginWalletTools
}

export const toEdgeTransaction = async (
  args: ToEdgeTransactionArgs
): Promise<EdgeTransaction> => {
  const { tx, processor, walletBlockHeight, walletTools, pluginInfo } = args
  const { currencyInfo, engineInfo } = pluginInfo
  const { validateConfirmations = defaultValidateConfirmations } = engineInfo
  const { requiredConfirmations } = currencyInfo

  const ourReceiveAddresses: string[] = []
  for (const out of tx.ourOuts) {
    const { scriptPubkey } = tx.outputs[parseInt(out)]
    const address = await processor.fetchAddress(scriptPubkey)

    /*
    Hack to set replay protection tx to the correct script type through the
    address format.

    We use a function which can determine whether the derivationLevelScriptHash
    was used for the path's change index in order to detect whether an address
    is used for replay protection. We need to detect this because we must treat
    the address format as bip49 because the script is P2SH even though the
    address is on the bip44 derivation chain.
    */
    const scriptTemplate = engineInfo.scriptTemplates?.replayProtection
    if (
      scriptTemplate != null &&
      address?.path != null &&
      isPathUsingDerivationLevelScriptHash(scriptTemplate, address.path)
    ) {
      address.path.format = 'bip49'
    }

    if (address?.path != null) {
      const { address: addrStr } = walletTools.scriptPubkeyToAddress({
        scriptPubkey,
        format: address.path.format
      })
      ourReceiveAddresses.push(addrStr)
    }
  }

  const confirmations = validateConfirmations(
    tx,
    walletBlockHeight,
    requiredConfirmations
  )

  const edgeTx = {
    currencyCode: args.currencyCode,
    txid: args.tx.txid,
    confirmations,
    blockHeight: args.tx.blockHeight,
    date: args.tx.date,
    nativeAmount: args.tx.ourAmount,
    networkFee: args.tx.fees,
    signedTx: args.tx.hex,
    ourReceiveAddresses
  }

  return edgeTx
}
