import * as bs from 'biggystring'
import { asMaybe } from 'cleaners'
import { makeMemoryDisklet } from 'disklet'
import {
  DustSpendError,
  EdgeCurrencyCodeOptions,
  EdgeCurrencyEngine,
  EdgeDataDump,
  EdgeFreshAddress,
  EdgeGetReceiveAddressOptions,
  EdgeGetTransactionsOptions,
  EdgePaymentProtocolInfo,
  EdgeSignMessageOptions,
  EdgeSpendInfo,
  EdgeTokenInfo,
  EdgeTransaction,
  InsufficientFundsError,
  JsonObject
} from 'edge-core-js'

import { filterUndefined } from '../../../util/filterUndefined'
import { unixTime } from '../../../util/unixTime'
import { makeFees } from '../../fees/makeFees'
import { EngineEmitter, EngineEvent } from '../../plugin/makeEngineEmitter'
import { makeMetadata } from '../../plugin/makeMetadata'
import { EngineConfig, TxOptions } from '../../plugin/types'
import { upgradeMemos } from '../../upgradeMemos'
import { makeProcessor } from '../db/makeProcessor'
import {
  fromEdgeTransaction,
  toEdgeTransaction
} from '../db/Models/ProcessorTransaction'
import { IProcessorTransaction, IUTXO } from '../db/types'
import { utxoFromProcessorTransactionInput } from '../db/util/utxo'
import {
  asPrivateKey,
  asSafeWalletInfo,
  SafeWalletInfo
} from '../keymanager/cleaners'
import {
  makeTx,
  MakeTxTarget,
  PrivateKeyEncoding,
  signTx
} from '../keymanager/keymanager'
import { transactionSizeFromHex } from '../keymanager/utxopicker/utils'
import { makeUtxoEngineState, transactionChanged } from './makeUtxoEngineState'
import { makeUtxoWalletTools } from './makeUtxoWalletTools'
import { createPayment, getPaymentDetails, sendPayment } from './paymentRequest'
import {
  asUtxoSignMessageOtherParams,
  asUtxoUserSettings,
  UtxoTxOtherParams
} from './types'
import { getOwnUtxosFromTx } from './util/getOwnUtxosFromTx'
import { fetchOrDeriveXprivFromKeys, sumUtxos } from './utils'

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

  const engine = {
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

    getBalance(_opts: EdgeCurrencyCodeOptions): string {
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

    async getEnabledTokens(): Promise<string[]> {
      return await Promise.resolve([])
    },

    async getFreshAddress(
      opts: EdgeGetReceiveAddressOptions
    ): Promise<EdgeFreshAddress> {
      const { forceIndex } = opts
      return await engineState.getFreshAddress({ forceIndex })
    },

    getNumTransactions(_opts: EdgeCurrencyCodeOptions): number {
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

    getTokenStatus(_token: string): boolean {
      return false
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
      const txOptions: TxOptions | undefined =
        edgeSpendInfo.otherParams?.txOptions
      const { outputSort = 'bip69', utxoSourceAddress, forceChangeAddress } =
        edgeSpendInfo.otherParams ?? {}

      let utxoScriptPubkey: string | undefined
      if (utxoSourceAddress != null) {
        utxoScriptPubkey = walletTools.addressToScriptPubkey(utxoSourceAddress)
      }

      if (txOptions?.CPFP == null && spendTargets.length < 1) {
        throw new Error('Need to provide Spend Targets')
      }
      // Calculate the total amount to send
      const totalAmountToSend = spendTargets.reduce(
        (sum, { nativeAmount }) => bs.add(sum, nativeAmount ?? '0'),
        '0'
      )
      const utxos =
        txOptions?.utxos ??
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
        throw new InsufficientFundsError(currencyInfo.currencyCode)
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
            if (processor.fetchAddress(scriptPubkey) != null) {
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

      const setRBF = txOptions?.setRBF ?? false
      const rbfTxid = edgeSpendInfo.rbfTxid
      let maxUtxo: undefined | IUTXO
      let feeRate = parseInt(await fees.getRate(edgeSpendInfo))
      if (rbfTxid != null) {
        const [rbfTx] = await processor.fetchTransactions({ txId: rbfTxid })
        if (rbfTx == null) throw new Error('transaction not found')

        // double the fee used for the RBF transaction
        const vBytes = transactionSizeFromHex(rbfTx.hex)
        feeRate = Math.round(parseInt(rbfTx.fees) / vBytes) * 2

        const rbfInputs = rbfTx.inputs
        const maxInput = rbfInputs.reduce((a, b) =>
          bs.gt(a.amount, b.amount) ? a : b
        )
        maxUtxo = await utxoFromProcessorTransactionInput(
          processor,
          rbfTx,
          maxInput.n
        )
      }
      if (txOptions?.CPFP != null) {
        const [childTx] = await processor.fetchTransactions({
          txId: txOptions?.CPFP
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
        txOptions?.subtractFee != null ? txOptions.subtractFee : false
      const tx = makeTx({
        utxos,
        forceUseUtxo: maxUtxo != null ? [maxUtxo] : [],
        targets,
        memos,
        feeRate,
        coin: coinInfo.name,
        currencyCode: currencyInfo.currencyCode,
        setRBF,
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
      if (psbt == null || edgeSpendInfo == null)
        throw new Error('Invalid transaction data')

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
        if (edgeSpendInfo.privateKeys != null) {
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
            const destAddress = await this.getFreshAddress({})
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
