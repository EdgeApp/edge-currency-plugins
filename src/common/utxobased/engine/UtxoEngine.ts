import * as bs from 'biggystring'
import { asMaybe } from 'cleaners'
import { makeMemoryDisklet } from 'disklet'
import {
  DustSpendError,
  EdgeCurrencyEngine,
  EdgeDataDump,
  EdgeFreshAddress,
  EdgeGetReceiveAddressOptions,
  EdgeGetTransactionsOptions,
  EdgePaymentProtocolInfo,
  EdgeSignMessageOptions,
  EdgeSpendInfo,
  EdgeTokenIdOptions,
  EdgeTokenInfo,
  EdgeTransaction,
  InsufficientFundsError,
  JsonObject
} from 'edge-core-js'

import { filterUndefined } from '../../../util/filterUndefined'
import { unixTime } from '../../../util/unixTime'
import { makeFees } from '../../fees/makeFees'
import { EngineEmitter, EngineEvent } from '../../plugin/EngineEmitter'
import { makeMetadata } from '../../plugin/Metadata'
import { EngineConfig, TxOptions } from '../../plugin/types'
import { upgradeMemos } from '../../upgradeMemos'
import {
  fromEdgeTransaction,
  toEdgeTransaction
} from '../db/Models/ProcessorTransaction'
import { makeProcessor } from '../db/Processor'
import { IProcessorTransaction, IUTXO } from '../db/types'
import { utxoFromProcessorTransactionInput } from '../db/util/utxo'
import {
  asPrivateKey,
  asSafeWalletInfo,
  SafeWalletInfo
} from '../keymanager/cleaners'
import {
  makeTx,
  MakeTxArgs,
  MakeTxTarget,
  PrivateKeyEncoding,
  scriptPubkeyToAddress,
  signTx
} from '../keymanager/keymanager'
import { asMaybeInsufficientFundsErrorPlus } from '../keymanager/types'
import { transactionSizeFromHex } from '../keymanager/utxopicker/utils'
import { createPayment, getPaymentDetails, sendPayment } from './paymentRequest'
import {
  asUtxoSignMessageOtherParams,
  asUtxoSpendInfoOtherParams,
  asUtxoUserSettings,
  UtxoTxOtherParams
} from './types'
import { getOwnUtxosFromTx } from './util/getOwnUtxosFromTx'
import {
  fetchOrDeriveXprivFromKeys,
  getAddressTypeFromPurposeType,
  pathToPurposeType,
  sumUtxos
} from './utils'
import { makeUtxoEngineState, transactionChanged } from './UtxoEngineState'
import { makeUtxoWalletTools } from './UtxoWalletTools'

export async function makeUtxoEngine(
  config: EngineConfig
): Promise<EdgeCurrencyEngine> {
  const {
    pluginInfo,
    pluginDisklet,
    // Rename to make it explicit that this is sensitive memory
    options,
    io,
    pluginState
  } = config
  const {
    walletLocalDisklet,
    walletLocalEncryptedDisklet,
    emitter,
    log
  } = options
  const { currencyInfo, engineInfo, coinInfo } = pluginInfo
  const userSettings = asUtxoUserSettings(options.userSettings)

  // We should move the active server list to the engine state,
  // since multiple accounts can be logged in at once,
  // each with a different list of custom servers.
  // The Edge UI only allows for one active login, though,
  // so this is OK for now:
  pluginState.updateServers(userSettings).catch(err => {
    log.error(err)
  })

  const asCurrencyPrivateKey = asPrivateKey(coinInfo.name, coinInfo.coinType)
  // Private key may be missing for read-only wallets
  const asMaybeCurrencyPrivateKey = asMaybe(asCurrencyPrivateKey)

  // This walletInfo will not contain private keys and should only contain the
  // public keys and so can be passed around the plugin safely.
  const walletInfo = asSafeWalletInfo(pluginInfo)(config.walletInfo)
  const { privateKeyFormat, publicKey, walletFormats } = walletInfo.keys

  if (
    engineInfo.formats == null ||
    !engineInfo.formats.includes(privateKeyFormat)
  ) {
    const message = `Wallet format is not supported: ${privateKeyFormat}`
    log.error(message)
    throw new Error(message)
  }

  const walletTools = makeUtxoWalletTools({
    pluginInfo,
    publicKey
  })

  const fees = await makeFees({
    disklet: pluginDisklet,
    pluginInfo,
    io,
    log: config.options.log
  })

  const metadata = await makeMetadata({
    disklet: walletLocalDisklet,
    emitter,
    log
  })
  const processor = await makeProcessor({
    disklet: walletLocalDisklet
  })
  const engineState = makeUtxoEngineState({
    ...config,
    walletTools,
    walletInfo,
    processor,
    pluginState
  })

  const engine: EdgeCurrencyEngine = {
    async accelerate(edgeTx: EdgeTransaction): Promise<EdgeTransaction | null> {
      const { canReplaceByFee = false } = currencyInfo
      if (!canReplaceByFee) return null

      // Accelerate for non-segwit wallets is not supported
      if (privateKeyFormat === 'bip32' || privateKeyFormat === 'bip44')
        return null

      // Get the replaced transaction from the processor:
      const replacedTxid = edgeTx.txid
      const [replacedTx] = await processor.fetchTransactions({
        txId: replacedTxid
      })

      // Transaction checks:
      // The transaction must be found and not confirmed or dropped.
      if (replacedTx == null) return null
      if (replacedTx.blockHeight !== 0) return null

      // Double the fee used for the RBF transaction:
      const vBytes = transactionSizeFromHex(replacedTx.hex)
      const newFeeRate = Math.round((parseInt(replacedTx.fees) / vBytes) * 2)

      const replacedTxInputs = replacedTx.inputs
      // Recreate UTXOs from processor transaction and mark them as unspent:
      const replacedTxUtxos = await Promise.all(
        replacedTxInputs.map(async (_, index) => {
          const utxo = await utxoFromProcessorTransactionInput(
            processor,
            replacedTx,
            index
          )
          // Mark as unspent because we're going to reuse replaced tx's UTXOs
          utxo.spent = false
          return utxo
        })
      )
      // Get the largest input from the transaction to re-use:
      const replacedTxMaxUtxo = replacedTxUtxos.reduce((maxUtxo, utxo) => {
        if (utxo.value > maxUtxo.value) return utxo
        return maxUtxo
      })

      const targets: MakeTxTarget[] = []
      const newOurReceiveAddresses: string[] = []
      let foundChangeAddress: string | undefined
      for (const output of replacedTx.outputs) {
        // Fetch address by output's scriptPubkey to determine output ownership
        const ourAddress = await processor.fetchAddress(output.scriptPubkey)

        // This isn't our output, so include it as a target
        if (ourAddress == null) {
          targets.push({
            scriptPubkey: output.scriptPubkey,
            value: parseInt(output.amount)
          })
          continue
        }

        // Addresses from database should include a path; this is a type assert
        if (ourAddress.path == null)
          throw new Error('Expecting path for address')

        // The output is ours:
        const purposeType = pathToPurposeType(
          ourAddress.path,
          engineInfo.scriptTemplates
        )
        const addressType = getAddressTypeFromPurposeType(purposeType)
        const { address } = scriptPubkeyToAddress({
          scriptPubkey: ourAddress.scriptPubkey,
          addressType,
          coin: coinInfo.name,
          redeemScript: ourAddress.redeemScript
        })

        newOurReceiveAddresses.push(address)

        // Detect if it's the change address:
        if (ourAddress.path.changeIndex === 1) {
          foundChangeAddress = address
        } else {
          // This isn't our change address, so include it as a target.
          // The transaction must have been a spend-to-self.
          targets.push({
            scriptPubkey: output.scriptPubkey,
            value: parseInt(output.amount)
          })
        }
      }

      // Use the found change address or generate a new one:
      const freshAddress =
        foundChangeAddress == null
          ? await engineState.getFreshAddress({ branch: 1 })
          : { publicAddress: foundChangeAddress }
      const freshChangeAddress =
        freshAddress.segwitAddress ?? freshAddress.publicAddress

      // Get all current UTXOs:
      const currentUtxos = filterUndefined(
        await processor.fetchUtxos({
          utxoIds: []
        })
      )
        // Exclude all UTXOs which are from the replaced tx, because
        // they wont be valid.
        .filter(utxo => utxo.txid !== replacedTxid)

      // Combine replaced transaction's inputs as UTXOs with the current UTXO set
      const utxos = [...replacedTxUtxos, ...currentUtxos]

      // New transaction to be the replacement transaction
      const makeTxArgs: MakeTxArgs = {
        utxos,
        forceUseUtxo: [replacedTxMaxUtxo],
        targets,
        memos: edgeTx.memos,
        feeRate: newFeeRate,
        coin: coinInfo.name,
        currencyCode: currencyInfo.currencyCode,
        enableRbf: true,
        freshChangeAddress,
        subtractFee: false,
        log,
        outputSort: 'bip69'
      }
      const newTx = (() => {
        try {
          return makeTx(makeTxArgs)
        } catch (error) {
          const cleanError = asMaybeInsufficientFundsErrorPlus(error)
          if (cleanError?.networkFeeShortage != null) {
            let feeDelta = parseInt(cleanError.networkFeeShortage)
            // Adjust target values until we diminish the fee delta completely
            for (const target of targets) {
              if (target.value == null) continue
              // The term is how much value to subtract from the target's value.
              // The term's maximum value is the target's value.
              // The term's minimum value is the fee delta.
              const term = Math.min(target.value, feeDelta)
              target.value -= term // Either decrement or zero out
              feeDelta -= term // Ether decrement or zero out
            }
            // Retry making the transaction
            return makeTx(makeTxArgs)
          }
          throw error
        }
      })()

      if (newTx.changeUsed) {
        newOurReceiveAddresses.push(freshChangeAddress)
      }

      // Generate new tracking of our scripts:
      const newOurScriptPubkeys: string[] = newTx.inputs.map(input =>
        input.scriptPubkey.toString('hex')
      )

      // Calculate transaction spend amount:
      let nativeAmount = '0'
      for (const output of newTx.outputs) {
        const scriptPubkey = output.scriptPubkey.toString('hex')
        const own = await processor.fetchAddress(scriptPubkey)
        if (own == null) {
          // Not our output
          nativeAmount = bs.sub(nativeAmount, output.value.toString())
        } else {
          // Our output
          newOurScriptPubkeys.push(scriptPubkey)
        }
      }

      const networkFee = newTx.fee.toString()
      nativeAmount = bs.sub(nativeAmount, networkFee)

      const newTxOtherParams: UtxoTxOtherParams = {
        unsignedTx: newTx.hex,
        psbt: {
          base64: newTx.psbtBase64,
          inputs: newTx.inputs,
          outputs: newTx.outputs
        },
        ourScriptPubkeys: newOurScriptPubkeys,
        replacedTxid: replacedTxid
      }

      // Return a EdgeTransaction object with the updates
      return {
        ...edgeTx,
        blockHeight: 0,
        currencyCode: currencyInfo.currencyCode,
        date: unixTime(),
        feeRateUsed: {
          satPerVByte: newFeeRate
        },
        isSend: true,
        nativeAmount,
        networkFee,
        otherParams: newTxOtherParams,
        ourReceiveAddresses: newOurReceiveAddresses,
        parentNetworkFee: undefined,
        signedTx: '',
        txid: '',
        walletId: walletInfo.id
      }
    },

    async startEngine(): Promise<void> {
      emitter.emit(
        EngineEvent.WALLET_BALANCE_CHANGED,
        currencyInfo.currencyCode,
        metadata.state.balance
      )

      pluginState.addEngine(engineState)
      await fees.start()
      await engineState.start()
    },

    async killEngine(): Promise<void> {
      await engineState.stop()
      fees.stop()
      pluginState.removeEngine(engineState)
    },

    getBalance(_opts: EdgeTokenIdOptions): string {
      return metadata.state.balance
    },

    getBlockHeight(): number {
      return metadata.state.lastSeenBlockHeight
    },

    async addCustomToken(_token: EdgeTokenInfo): Promise<void> {
      return await Promise.resolve(undefined)
    },

    async addGapLimitAddresses(addresses: string[]): Promise<void> {
      return await engineState.addGapLimitAddresses(addresses)
    },

    async broadcastTx(transaction: EdgeTransaction): Promise<EdgeTransaction> {
      const { otherParams } = transaction
      if (
        otherParams?.paymentProtocolInfo?.payment != null &&
        otherParams?.paymentProtocolInfo?.paymentUrl != null
      ) {
        const paymentAck = await sendPayment(
          io.fetch,
          otherParams.paymentProtocolInfo.paymentUrl,
          otherParams.paymentProtocolInfo.payment
        )
        if (typeof paymentAck === 'undefined') {
          throw new Error(
            `Error when sending to ${otherParams.paymentProtocolInfo.paymentUrl}`
          )
        }
      }
      const id = await engineState.broadcastTx(transaction).catch(err => {
        if (String(err).includes('Error: Blockbook Error: -26: dust')) {
          throw new DustSpendError()
        }
        throw err
      })
      if (id !== transaction.txid) {
        throw new Error('broadcast response txid does not match original')
      }
      return transaction
    },

    async changeUserSettings(userSettings: JsonObject): Promise<void> {
      await pluginState.updateServers(asUtxoUserSettings(userSettings))
    },

    async disableTokens(_tokens: string[]): Promise<void> {
      return await Promise.resolve(undefined)
    },

    async dumpData(): Promise<EdgeDataDump> {
      return {
        walletId: walletInfo.id.split(' - ')[0],
        walletType: walletInfo.type,
        data: {
          walletInfo: {
            pluginType: currencyInfo.pluginId,
            privateKeyFormat,
            walletFormats
          },
          metadataState: metadata.state,
          processorState: await processor.dumpData(),
          pluginState: pluginState.dumpData()
        }
      }
    },

    async enableTokens(_tokens: string[]): Promise<void> {
      return await Promise.resolve(undefined)
    },

    getDisplayPrivateSeed(privateKeys: JsonObject): string | null {
      const privateKey = asMaybeCurrencyPrivateKey(privateKeys)
      if (privateKey == null) return null
      return privateKey.format === 'bip32'
        ? Buffer.from(privateKey.seed, 'base64').toString('hex')
        : privateKey.seed
    },

    getDisplayPublicSeed(): string | null {
      const xpubs = publicKey.publicKeys
      return Object.values(xpubs)
        .filter(xpub => xpub != null)
        .join('\n')
    },

    async getFreshAddress(
      opts: EdgeGetReceiveAddressOptions
    ): Promise<EdgeFreshAddress> {
      const { forceIndex } = opts
      return await engineState.getFreshAddress({ forceIndex })
    },

    getNumTransactions(_opts: EdgeTokenIdOptions): number {
      return processor.numTransactions()
    },

    async getPaymentProtocolInfo(
      paymentProtocolUrl: string
    ): Promise<EdgePaymentProtocolInfo> {
      return await getPaymentDetails(
        paymentProtocolUrl,
        currencyInfo.currencyCode,
        io.fetch
      )
    },

    async getTransactions(
      options: EdgeGetTransactionsOptions
    ): Promise<EdgeTransaction[]> {
      const txs = filterUndefined(
        await processor.fetchTransactions({ options })
      )
      return await Promise.all(
        txs.map(
          async (tx: IProcessorTransaction) =>
            await toEdgeTransaction({
              walletId: walletInfo.id,
              tx,
              walletTools,
              processor,
              pluginInfo
            })
        )
      )
    },

    async isAddressUsed(address: string): Promise<boolean> {
      const scriptPubkey = walletTools.addressToScriptPubkey(address)
      const addressData = await processor.fetchAddress(scriptPubkey)
      if (addressData == null) throw new Error('Address not found in wallet')
      return addressData.used
    },

    async makeSpend(edgeSpendInfo: EdgeSpendInfo): Promise<EdgeTransaction> {
      edgeSpendInfo = upgradeMemos(edgeSpendInfo, currencyInfo)
      const { memos = [], spendTargets } = edgeSpendInfo
      const spendInfoOtherParams = asUtxoSpendInfoOtherParams(
        edgeSpendInfo.otherParams ?? {}
      )
      const txOptions = spendInfoOtherParams.txOptions ?? {}
      const {
        outputSort,
        utxoSourceAddress,
        forceChangeAddress
      } = spendInfoOtherParams

      let utxoScriptPubkey: string | undefined
      if (utxoSourceAddress != null) {
        utxoScriptPubkey = walletTools.addressToScriptPubkey(utxoSourceAddress)
      }

      if (txOptions.CPFP == null && spendTargets.length < 1) {
        throw new Error('Need to provide Spend Targets')
      }
      // Calculate the total amount to send
      const totalAmountToSend = spendTargets.reduce(
        (sum, { nativeAmount }) => bs.add(sum, nativeAmount ?? '0'),
        '0'
      )
      const utxos =
        txOptions.utxos ??
        filterUndefined(
          (await processor.fetchUtxos({
            scriptPubkey: utxoScriptPubkey,
            utxoIds: []
          })) as IUTXO[]
        )

      if (
        bs.gt(totalAmountToSend, `${sumUtxos(utxos)}`) ||
        utxos.length === 0
      ) {
        throw new InsufficientFundsError({ tokenId: null })
      }

      let targets: MakeTxTarget[] = []
      const ourReceiveAddresses: string[] = []
      for (const target of spendTargets) {
        if (target.publicAddress == null || target.nativeAmount == null) {
          throw new Error('Invalid spend target')
        }

        // if script exists construct address from script
        if (target.otherParams?.script != null) {
          const { script } = target.otherParams
          if (script.type === 'replayProtection') {
            // construct a replay protection p2sh address
            const { publicAddress } = await engineState.deriveScriptAddress(
              script.type
            )
            targets.push({
              address: publicAddress,
              value:
                target.nativeAmount == null
                  ? undefined
                  : parseInt(target.nativeAmount)
            })
          }
        } else {
          if (target.publicAddress != null) {
            const scriptPubkey = walletTools.addressToScriptPubkey(
              target.publicAddress
            )
            if ((await processor.fetchAddress(scriptPubkey)) != null) {
              ourReceiveAddresses.push(target.publicAddress)
            }
          }
          targets.push({
            address: target.publicAddress,
            value:
              target.nativeAmount == null
                ? undefined
                : parseInt(target.nativeAmount)
          })
        }
      }

      if (targets.length + memos.length < 1) {
        throw new Error('Need to provide Spend Targets')
      }

      const freshAddress = await engineState.getFreshAddress({ branch: 1 })
      const freshChangeAddress =
        forceChangeAddress ??
        freshAddress.segwitAddress ??
        freshAddress.publicAddress

      const feeRate = parseInt(await fees.getRate(edgeSpendInfo))

      let maxUtxo: undefined | IUTXO
      if (txOptions.CPFP != null) {
        const [childTx] = await processor.fetchTransactions({
          txId: txOptions.CPFP
        })
        if (childTx == null) throw new Error('transaction not found')
        const utxos: IUTXO[] = []
        for (const txid of childTx.ourOuts) {
          const [output] = await processor.fetchUtxos({ utxoIds: [txid] })
          if (output != null) utxos.push(output)
        }
        maxUtxo = utxos.reduce((a, b) => (bs.gt(a.value, b.value) ? a : b))
        // cpfp just sends to change, no target addresses are required
        targets = []
      }

      log.warn(`spend: Using fee rate ${feeRate} sat/B`)
      const subtractFee =
        txOptions.subtractFee != null ? txOptions.subtractFee : false
      const tx = makeTx({
        utxos,
        forceUseUtxo: maxUtxo != null ? [maxUtxo] : [],
        targets,
        memos,
        feeRate,
        coin: coinInfo.name,
        currencyCode: currencyInfo.currencyCode,
        enableRbf:
          spendInfoOtherParams.enableRbf ??
          currencyInfo.canReplaceByFee ??
          false,
        freshChangeAddress,
        subtractFee,
        log,
        outputSort
      })
      if (tx.changeUsed) {
        ourReceiveAddresses.push(freshChangeAddress)
      }

      let nativeAmount = '0'
      const ourScriptPubkeys: string[] = tx.inputs.map(input =>
        input.scriptPubkey.toString('hex')
      )
      for (const output of tx.outputs) {
        const scriptPubkey = output.scriptPubkey.toString('hex')
        const own = await processor.fetchAddress(scriptPubkey)
        if (own == null) {
          // Not our output
          nativeAmount = bs.sub(nativeAmount, output.value.toString())
        } else {
          // Our output
          ourScriptPubkeys.push(scriptPubkey)
        }
      }

      const networkFee = tx.fee.toString()
      nativeAmount = bs.sub(nativeAmount, networkFee)

      const otherParams: UtxoTxOtherParams = {
        unsignedTx: tx.hex,
        psbt: {
          base64: tx.psbtBase64,
          inputs: tx.inputs,
          outputs: tx.outputs
        },
        edgeSpendInfo,
        ourScriptPubkeys
      }

      const transaction: EdgeTransaction = {
        blockHeight: 0,
        currencyCode: currencyInfo.currencyCode,
        date: unixTime(),
        feeRateUsed: {
          satPerVByte: feeRate
        },
        isSend: true,
        memos,
        nativeAmount,
        networkFee,
        otherParams,
        ourReceiveAddresses,
        signedTx: '',
        tokenId: null,
        txid: '',
        walletId: walletInfo.id
      }

      return transaction
    },

    async resyncBlockchain(): Promise<void> {
      // Stops the engine
      await engine.killEngine()

      // Clear cache and state
      await processor.clearAll()
      await pluginState.clearCache()
      await metadata.clear()
      await fees.clearCache()

      // Refresh the servers for the engine
      await pluginState.refreshServers()

      // Restart the engine
      await engine.startEngine()
    },

    async saveTx(edgeTx: EdgeTransaction): Promise<void> {
      // If the transaction being saved replaces a transaction, update it.
      const replacedTxid: string | undefined = edgeTx.otherParams?.replacedTxid
      if (replacedTxid != null) {
        // Get the replaced transaction using the replacedTxid
        const [rbfTx] = await processor.fetchTransactions({
          txId: replacedTxid
        })
        if (rbfTx != null) {
          rbfTx.blockHeight = -1
          await transactionChanged({
            walletId: walletInfo.id,
            tx: rbfTx,
            pluginInfo,
            emitter,
            walletTools,
            processor
          })
        }
      }

      const tx = fromEdgeTransaction(edgeTx)
      await transactionChanged({
        walletId: walletInfo.id,
        tx,
        pluginInfo,
        emitter,
        walletTools,
        processor
      })
      await processor.saveTransaction({
        tx,
        scriptPubkeys: edgeTx.otherParams?.ourScriptPubkeys
      })

      /*
      Get the wallet's UTXOs from the new transaction and save them to the processsor.
      */
      const ownUtxos = await getOwnUtxosFromTx(engineInfo, processor, tx)
      await engineState.processUtxos(ownUtxos)
    },

    async signMessage(
      message: string,
      privateKeys: JsonObject,
      opts: EdgeSignMessageOptions
    ): Promise<string> {
      const otherParams = asUtxoSignMessageOtherParams(opts.otherParams)
      const { publicAddress } = otherParams
      const scriptPubkey = walletTools.addressToScriptPubkey(publicAddress)
      const processorAddress = await processor.fetchAddress(scriptPubkey)
      if (processorAddress?.path == null) {
        throw new Error('Missing address to sign with')
      }
      const privateKey = asMaybeCurrencyPrivateKey(privateKeys)

      if (privateKey == null)
        throw new Error('Cannot sign a message for a read-only wallet')

      // Derive the xprivs on the fly, since we do not persist them
      const xprivKeys = await fetchOrDeriveXprivFromKeys({
        privateKey,
        walletLocalEncryptedDisklet,
        coin: coinInfo.name
      })

      const signature = await walletTools.signMessageBase64({
        path: processorAddress?.path,
        message,
        xprivKeys
      })
      return signature
    },

    async signTx(
      transaction: EdgeTransaction,
      privateKeys: JsonObject
    ): Promise<EdgeTransaction> {
      const otherParams = transaction.otherParams as UtxoTxOtherParams
      if (otherParams == null) throw new Error('Invalid transaction data')

      const { psbt, edgeSpendInfo }: UtxoTxOtherParams = otherParams
      if (psbt == null) throw new Error('Invalid transaction data')

      const privateKey = asMaybeCurrencyPrivateKey(privateKeys)

      if (privateKey == null)
        throw new Error('Cannot sign a transaction for a read-only wallet')

      // Derive the xprivs on the fly, since we do not persist them
      const xprivKeys = await fetchOrDeriveXprivFromKeys({
        privateKey,
        walletLocalEncryptedDisklet,
        coin: coinInfo.name
      })

      // Use the privateKeys (WIFs) from spendInfo, otherwise get them from the
      // PBST inputs.
      const privateKeyEncodings = await (async (): Promise<
        PrivateKeyEncoding[]
      > => {
        if (edgeSpendInfo?.privateKeys != null) {
          return edgeSpendInfo.privateKeys.map(wif =>
            walletTools.getPrivateKeyEncodingFromWif(wif)
          )
        } else {
          return await Promise.all(
            psbt.inputs.map(async ({ hash, index: vout }) => {
              const txId = Buffer.from(hash).reverse().toString('hex')

              const [transaction] = await processor.fetchTransactions({ txId })
              if (transaction == null)
                throw new Error(
                  'Unable to find previous transaction data for input'
                )
              const prevout = transaction.outputs.find(
                input => input.n === vout
              )
              if (prevout == null)
                throw new Error('Unable to find prevout in transaction')
              const { scriptPubkey } = prevout

              // Use the scriptPubkey to find the private key from the address
              // derivation path
              const address = await processor.fetchAddress(scriptPubkey)
              if (address == null) {
                throw new Error(
                  `Address for scriptPubkey '${scriptPubkey}' not found`
                )
              }
              if (address.path == null)
                throw new Error(
                  `Invalid scriptPubkey ${address.scriptPubkey}; Missing path`
                )

              const privateKey = walletTools.getPrivateKey({
                path: address.path,
                xprivKeys
              })
              return {
                hex: privateKey,
                compressed: true // We shouldn't ever be storing/deriving uncompressed keys
              }
            })
          )
        }
      })()
      const signedTx = await signTx({
        coin: coinInfo.name,
        feeInfo: fees.feeInfo,
        privateKeyEncodings: privateKeyEncodings,
        psbtBase64: psbt.base64
      })
      transaction.txid = signedTx.id
      transaction.signedTx = signedTx.hex

      const { paymentProtocolInfo } =
        transaction.otherParams?.edgeSpendInfo?.otherParams ?? {}
      if (paymentProtocolInfo != null) {
        const payment = createPayment(
          transaction.signedTx,
          transaction.currencyCode
        )
        if (transaction.otherParams == null) transaction.otherParams = {}
        Object.assign(transaction.otherParams, {
          paymentProtocolInfo: {
            ...paymentProtocolInfo,
            payment
          }
        })
      }

      // Update the transaction's date because it's has been modified
      transaction.date = unixTime()

      return transaction
    },

    async sweepPrivateKeys(spendInfo: EdgeSpendInfo): Promise<EdgeTransaction> {
      // Create the promise to return
      let success: (
        value: EdgeTransaction | PromiseLike<EdgeTransaction>
      ) => void
      let failure: (err?: any) => void
      const end = new Promise<EdgeTransaction>((resolve, reject) => {
        success = resolve
        failure = reject
      })

      // The temporary wallet info should include all formats for the currency
      const allFormats = engineInfo.formats
      if (allFormats == null) {
        throw new Error(
          `Missing  formats for wallet type ${currencyInfo.walletType}`
        )
      }

      const tmpWalletInfo: SafeWalletInfo = {
        id: walletInfo.id,
        type: walletInfo.type,
        keys: {
          privateKeyFormat: walletInfo.keys.privateKeyFormat,
          walletFormats: allFormats,
          publicKey: {
            publicKeys: {}
          }
        }
      }

      const privateKeys = spendInfo.privateKeys ?? []
      if (privateKeys.length < 1) throw new Error('No private keys given')

      // Make temporary wallet disklet
      const tmpDisklet = makeMemoryDisklet()
      const tmpEncryptedDisklet = makeMemoryDisklet()
      const tmpEmitter = new EngineEmitter()
      const tmpConfig = {
        disklet: tmpDisklet,
        emitter: tmpEmitter,
        log
      }
      const tmpMetadata = await makeMetadata(tmpConfig)
      const tmpProcessor = await makeProcessor(tmpConfig)
      const tmpWalletTools = makeUtxoWalletTools({
        pluginInfo,
        publicKey: tmpWalletInfo.keys.publicKey
      })

      // Max spend after imported wallet finishes sync
      tmpEmitter.on(EngineEvent.ADDRESSES_CHECKED, async (ratio: number) => {
        if (ratio === 1) {
          try {
            await tmpState.stop()

            const tmpUtxos = (await tmpProcessor.fetchUtxos({
              utxoIds: []
            })) as IUTXO[]
            if (tmpUtxos === null || tmpUtxos.length < 1) {
              throw new Error('Private key has no funds')
            }
            const destAddress = await this.getFreshAddress({ tokenId: null })
            const nativeAmount = tmpMetadata.state.balance
            const txOptions: TxOptions = { utxos: tmpUtxos, subtractFee: true }
            spendInfo.spendTargets = [
              { publicAddress: destAddress.publicAddress, nativeAmount }
            ]
            spendInfo.otherParams = {
              ...spendInfo.otherParams,
              txOptions
            }
            const tx = await this.makeSpend(spendInfo)
            success(tx)
          } catch (e) {
            failure(e)
          }
        }
      })

      const tmpState = makeUtxoEngineState({
        ...config,
        options: {
          ...config.options,
          walletLocalDisklet: tmpDisklet,
          walletLocalEncryptedDisklet: tmpEncryptedDisklet,
          emitter: tmpEmitter
        },
        pluginInfo: {
          ...pluginInfo,
          engineInfo: {
            ...engineInfo,
            // Disables setLookAhead because we're gonna load from WIFs
            gapLimit: 0
          }
        },
        processor: tmpProcessor,
        walletTools: tmpWalletTools,
        walletInfo: tmpWalletInfo
      })
      await tmpState.loadWifs(privateKeys)
      await tmpState.start()

      return await end
    },

    otherMethods: {}
  }

  return engine
}
