import { add, sub } from 'biggystring'
import {
  EdgeFreshAddress,
  EdgeIo,
  EdgeLog,
  EdgeTransaction
} from 'edge-core-js/types'

import { EngineEmitter, EngineEvent } from '../../plugin/makeEngineEmitter'
import {
  AddressPath,
  CurrencyFormat,
  EngineConfig,
  EngineInfo,
  PluginInfo
} from '../../plugin/types'
import { Processor } from '../db/makeProcessor'
import { toEdgeTransaction } from '../db/Models/ProcessorTransaction'
import {
  IAddress,
  IProcessorTransaction,
  IUTXO,
  makeIAddress
} from '../db/types'
import { NumbWalletInfo } from '../keymanager/cleaners'
import {
  BIP43PurposeTypeEnum,
  derivationLevelScriptHash,
  ScriptTypeEnum
} from '../keymanager/keymanager'
import {
  IAccountDetailsBasic,
  IAccountUTXO,
  ITransactionDetailsPaginationResponse
} from '../network/BlockBook'
import {
  addressMessage,
  addressUtxosMessage,
  asAddressUtxos,
  asITransaction,
  INewTransactionResponse,
  ITransaction,
  transactionMessage
} from '../network/BlockBookAPI'
import Deferred from '../network/Deferred'
import { WsTask } from '../network/Socket'
import AwaitLock from './await-lock'
import { BLOCKBOOK_TXS_PER_PAGE, CACHE_THROTTLE } from './constants'
import { makeServerStates, ServerStates } from './makeServerStates'
import { UTXOPluginWalletTools } from './makeUtxoWalletTools'
import { makeTaskState, TaskState } from './taskState'
import {
  currencyFormatToPurposeType,
  getCurrencyFormatFromPurposeType,
  getFormatSupportedBranches,
  validScriptPubkeyFromAddress
} from './utils'

export interface UtxoEngineState {
  processedPercent: number

  start: () => Promise<void>

  stop: () => Promise<void>

  deriveScriptAddress: (script: string) => Promise<EdgeFreshAddress>

  getFreshAddress: (branch?: number) => Promise<EdgeFreshAddress>

  addGapLimitAddresses: (addresses: string[]) => Promise<void>

  broadcastTx: (transaction: EdgeTransaction) => Promise<string>

  refillServers: () => void

  getServerList: () => string[]

  setServerList: (serverList: string[]) => void
}

export interface UtxoEngineStateConfig extends EngineConfig {
  walletTools: UTXOPluginWalletTools
  walletInfo: NumbWalletInfo
  processor: Processor
}

export function makeUtxoEngineState(
  config: UtxoEngineStateConfig
): UtxoEngineState {
  const {
    pluginInfo,
    walletInfo,
    walletTools,
    options: { emitter, log },
    processor,
    pluginState
  } = config

  const { supportedFormats } = walletInfo.keys

  const taskState = makeTaskState({ walletTools, processor })

  let processedCount = 0
  let processedPercent = 0
  const onAddressChecked = async (): Promise<void> => {
    processedCount = processedCount + 1
    const totalCount = await getTotalAddressCount(supportedFormats, processor)

    // If we have no addresses, we should not have not yet began processing.
    if (totalCount === 0) throw new Error('No addresses to process')

    const percent = processedCount / totalCount
    if (percent - processedPercent > CACHE_THROTTLE || percent === 1) {
      log(
        `processed changed, percent: ${percent}, processedCount: ${processedCount}, totalCount: ${totalCount}`
      )
      processedPercent = percent
      emitter.emit(EngineEvent.ADDRESSES_CHECKED, percent)
    }
  }

  const engineStarted = false
  const lock = new AwaitLock()

  const serverStates = makeServerStates({
    engineStarted,
    walletInfo,
    pluginState,
    engineEmitter: emitter,
    log
  })
  const commonArgs: CommonArgs = {
    engineStarted,
    pluginInfo,
    walletInfo,
    walletTools,
    processor,
    emitter,
    taskState,
    onAddressChecked,
    io: config.io,
    log,
    serverStates,
    supportedFormats,
    lock
  }

  const pickNextTaskCB = async (
    uri: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<boolean | WsTask<any> | undefined> => {
    return await pickNextTask({ ...commonArgs, uri })
  }

  serverStates.setPickNextTaskCB(pickNextTaskCB)

  let running = false
  const run = async (): Promise<void> => {
    if (running) return
    running = true

    await initializeAddressSubscriptions()
    await setLookAhead(commonArgs)
  }

  emitter.on(
    EngineEvent.BLOCK_HEIGHT_CHANGED,
    async (_uri: string, _blockHeight: number): Promise<void> => {
      const txs = await processor.fetchTransactions({
        blockHeight: 0
      })
      for (const tx of txs) {
        if (tx == null) continue
        taskState.updateTransactionTasks.add(tx.txid, { processing: false })
      }
    }
  )

  emitter.on(
    EngineEvent.NEW_ADDRESS_TRANSACTION,
    async (_uri: string, response: INewTransactionResponse): Promise<void> => {
      const task = taskState.addressSubscribeTasks.get(response.address)
      if (task != null) {
        const { path } = task
        taskState.utxoTasks.add(response.address, {
          processing: false,
          path
        })

        await taskState.addTransactionTask(
          response.address,
          path.format,
          path.branch,
          0
        )
        setLookAhead(commonArgs).catch(e => {
          log(e)
        })
      }
    }
  )

  // Initialize the addressSubscribeTasks with the existing addresses already
  // processed by the processor. This happens only once before any call to
  // setLookAhead.
  const initializeAddressSubscriptions = async (): Promise<void> => {
    const totalAddressCount = await getTotalAddressCount(
      supportedFormats,
      processor
    )

    if (taskState.addressSubscribeTasks.size < totalAddressCount) {
      for (const format of supportedFormats) {
        const branches = getFormatSupportedBranches(format)
        for (const branch of branches) {
          const branchAddressCount = processor.numAddressesByFormatPath({
            format,
            changeIndex: branch
          })
          // If the processor has not processed any addresses then the loop
          // condition will only iterate once when branchAddressCount is 0 for the
          // first address in the derivation path.
          for (
            let addressIndex = 0;
            addressIndex < branchAddressCount;
            addressIndex++
          ) {
            const { address } = walletTools.getAddress({
              addressIndex,
              changeIndex: branch,
              format
            })
            taskState.addressSubscribeTasks.add(address, {
              path: {
                format,
                branch
              },
              processing: false
            })
          }
        }
      }
    }
  }

  return {
    processedPercent,
    async start(): Promise<void> {
      processedCount = 0
      processedPercent = 0

      await run()
      serverStates.refillServers()
    },

    async stop(): Promise<void> {
      serverStates.stop()
      taskState.clearTaskState()
      running = false
    },

    async getFreshAddress(branch = 0): Promise<EdgeFreshAddress> {
      const walletPurpose = currencyFormatToPurposeType(walletInfo.keys.format)
      if (walletPurpose === BIP43PurposeTypeEnum.Segwit) {
        const { address: publicAddress } = await internalGetFreshAddress({
          ...commonArgs,
          format: getCurrencyFormatFromPurposeType(
            BIP43PurposeTypeEnum.WrappedSegwit
          ),
          branch: branch
        })

        const { address: segwitAddress } = await internalGetFreshAddress({
          ...commonArgs,
          format: getCurrencyFormatFromPurposeType(BIP43PurposeTypeEnum.Segwit),
          branch: branch
        })

        return {
          publicAddress,
          segwitAddress
        }
      } else {
        // Airbitz wallets only use branch 0
        if (walletPurpose !== BIP43PurposeTypeEnum.Airbitz) {
          branch = 0
        }

        const {
          address: publicAddress,
          legacyAddress
        } = await internalGetFreshAddress({
          ...commonArgs,
          format: getCurrencyFormatFromPurposeType(walletPurpose),
          branch: branch
        })

        return {
          publicAddress,
          legacyAddress:
            legacyAddress !== publicAddress ? legacyAddress : undefined
        }
      }
    },

    async deriveScriptAddress(script): Promise<EdgeFreshAddress> {
      const { address } = await internalDeriveScriptAddress({
        walletTools: commonArgs.walletTools,
        engineInfo: commonArgs.pluginInfo.engineInfo,
        processor: commonArgs.processor,
        taskState: commonArgs.taskState,
        format: walletInfo.keys.format,
        script
      })
      return {
        publicAddress: address
      }
    },

    async addGapLimitAddresses(addresses: string[]): Promise<void> {
      const promises = addresses.map(async address => {
        const scriptPubkey = walletTools.addressToScriptPubkey(address)
        await processor.saveAddress(
          makeIAddress({
            scriptPubkey,
            used: true
          })
        )
      })
      await Promise.all(promises)
      await run()
    },

    async broadcastTx(transaction: EdgeTransaction): Promise<string> {
      // put spent utxos into an interim data structure (saveSpentUtxo)
      // these utxos are removed once the transaction confirms
      const [tx] = await processor.fetchTransactions({ txId: transaction.txid })
      if (tx != null) {
        for (const inputs of tx.inputs) {
          const [utxo] = await processor.fetchUtxos({
            utxoIds: [`${inputs.txId}_${inputs.outputIndex}`]
          })
          if (utxo != null) {
            utxo.spent = true
            await processor.saveUtxo(utxo)
          }
        }
      }
      const txId = await serverStates.broadcastTx(transaction)
      return txId
    },
    refillServers(): void {
      serverStates.refillServers()
    },
    getServerList(): string[] {
      return serverStates.getServerList()
    },
    setServerList(serverList: string[]) {
      serverStates.setServerList(serverList)
    }
  }
}

interface CommonArgs {
  engineStarted: boolean
  pluginInfo: PluginInfo
  walletInfo: NumbWalletInfo
  walletTools: UTXOPluginWalletTools
  processor: Processor
  emitter: EngineEmitter
  taskState: TaskState
  onAddressChecked: () => void
  io: EdgeIo
  log: EdgeLog
  serverStates: ServerStates
  supportedFormats: CurrencyFormat[]
  lock: AwaitLock
}

interface ShortPath {
  format: CurrencyFormat
  branch: number
}

interface FormatArgs extends CommonArgs, ShortPath {}

const setLookAhead = async (common: CommonArgs): Promise<void> => {
  const {
    pluginInfo: { engineInfo },
    lock,
    processor,
    supportedFormats,
    taskState,
    walletTools
  } = common

  // Wait for the lock to be released before continuing invocation.
  // This is to ensure that setLockAhead is not called while the lock is held.
  await lock.acquireAsync()

  try {
    for (const format of supportedFormats) {
      const branches = getFormatSupportedBranches(format)
      for (const branch of branches) {
        await deriveKeys({ format, branch })
      }
    }
  } finally {
    lock.release()
  }

  async function deriveKeys(shortPath: ShortPath): Promise<void> {
    const formatPath: Omit<AddressPath, 'addressIndex'> = {
      format: shortPath.format,
      changeIndex: shortPath.branch
    }
    const totalAddressCount = processor.numAddressesByFormatPath(formatPath)
    let lastUsedIndex = await processor.lastUsedIndexByFormatPath({
      ...formatPath
    })

    // Loop until the total address count equals the lookahead count
    let lookAheadIndex = lastUsedIndex + engineInfo.gapLimit
    let nextAddressIndex = totalAddressCount
    while (nextAddressIndex <= lookAheadIndex) {
      const path: AddressPath = {
        ...formatPath,
        addressIndex: nextAddressIndex
      }

      const { scriptPubkey, redeemScript } = walletTools.getScriptPubkey(path)
      const { address } = walletTools.scriptPubkeyToAddress({
        scriptPubkey,
        format: path.format
      })

      // Make a new IAddress and save it
      await processor.saveAddress(
        makeIAddress({ scriptPubkey, redeemScript, path })
      )

      // Add the address to the set of addresses to subscribe to after loop
      taskState.addressSubscribeTasks.add(address, {
        path: shortPath,
        processing: false
      })

      // Update the state for the loop
      lastUsedIndex = await processor.lastUsedIndexByFormatPath({
        ...formatPath
      })
      lookAheadIndex = lastUsedIndex + engineInfo.gapLimit
      nextAddressIndex = processor.numAddressesByFormatPath(formatPath)
    }
  }
}

interface TransactionChangedArgs {
  tx: IProcessorTransaction
  emitter: EngineEmitter
  walletTools: UTXOPluginWalletTools
  pluginInfo: PluginInfo
  processor: Processor
}

export const transactionChanged = async (
  args: TransactionChangedArgs
): Promise<void> => {
  const {
    emitter,
    walletTools,
    processor,
    pluginInfo: { currencyInfo },
    tx
  } = args
  emitter.emit(EngineEvent.TRANSACTIONS_CHANGED, [
    await toEdgeTransaction({
      tx,
      currencyCode: currencyInfo.currencyCode,
      walletTools,
      processor
    })
  ])
}

interface NextTaskArgs extends CommonArgs {
  uri: string
}

export const pickNextTask = async (
  args: NextTaskArgs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<WsTask<any> | undefined | boolean> => {
  const { taskState, uri, serverStates } = args

  const {
    addressSubscribeTasks,
    utxoTasks,
    rawUtxoTasks,
    processedUtxoTasks,
    transactionTasks,
    updateTransactionTasks
  } = taskState

  const serverState = serverStates.getServerState(uri)
  if (serverState == null) return

  // subscribe all servers to new blocks
  if (!serverState.subscribedBlocks) {
    serverState.subscribedBlocks = true
    const queryTime = Date.now()
    const deferredBlockSub = new Deferred<unknown>()
    deferredBlockSub.promise
      .then(() => {
        serverStates.serverScoreUp(uri, Date.now() - queryTime)
      })
      .catch(() => {
        serverState.subscribedBlocks = false
      })
    serverStates.watchBlocks(uri, deferredBlockSub)
    return true
  }

  // Loop processed utxos, these are just database ops, triggers setLookAhead
  if (processedUtxoTasks.size > 0) {
    for (const [scriptPubkey, task] of processedUtxoTasks.entries) {
      // Only process when all utxos for a specific address have been gathered
      if (!task.processing && task.full) {
        task.processing = true
        await processUtxoTransactions({
          ...args,
          scriptPubkey,
          utxos: task.utxos,
          path: task.path
        })
        processedUtxoTasks.remove(scriptPubkey)
        return true
      }
    }
  }

  // Loop unparsed utxos, some require a network call to get the full tx data
  for (const [utxoString, task] of rawUtxoTasks.entries) {
    const utxo: IAccountUTXO = JSON.parse(utxoString)
    if (utxo == null) continue
    if (!task.processing) {
      // check if we need to fetch additional network content for legacy purpose type
      const purposeType = currencyFormatToPurposeType(task.path.format)
      if (
        purposeType === BIP43PurposeTypeEnum.Airbitz ||
        purposeType === BIP43PurposeTypeEnum.Legacy
      ) {
        // if we do need to make a network call, check with the serverState
        if (!serverStates.serverCanGetTx(uri, utxo.txid)) return
      }
      task.processing = true
      rawUtxoTasks.remove(utxoString)
      const wsTask = await processRawUtxo({
        ...args,
        ...task,
        ...task.path,
        address: task.address,
        utxo,
        id: `${utxo.txid}_${utxo.vout}`
      })
      return wsTask ?? true
    }
  }

  // Loop to process addresses to utxos
  for (const [address, task] of utxoTasks.entries) {
    // Check if we need to fetch address UTXOs
    if (!task.processing && serverStates.serverCanGetAddress(uri, address)) {
      task.processing = true

      utxoTasks.remove(address)

      // Fetch and process address UTXOs
      const wsTask = await processAddressUtxos({
        ...args,
        ...task,
        address
      })
      wsTask.deferred.promise
        .then(() => {
          serverState.addresses.add(address)
        })
        .catch(e => {
          throw e
        })
      return wsTask
    }
  }

  // Check if there are any addresses pending to be subscribed
  if (addressSubscribeTasks.size > 0 && !taskState.addressWatching) {
    const blockHeight = serverStates.getBlockHeight(uri)
    // Loop each address that needs to be subscribed
    for (const [address, task] of addressSubscribeTasks.entries) {
      // Add address in the cache to the set of addresses to watch
      // only process newly watched addresses
      if (task.processing) continue
      if (task.path != null) {
        // Add the newly watched addresses to the UTXO cache
        utxoTasks.add(address, {
          processing: false,
          path: task.path
        })
        await taskState.addTransactionTask(
          address,
          task.path.format,
          task.path.branch,
          blockHeight
        )
      }
      task.processing = true
    }

    taskState.addressWatching = true

    const queryTime = Date.now()
    const deferredAddressSub = new Deferred<unknown>()
    deferredAddressSub.promise
      .then(() => {
        serverStates.serverScoreUp(uri, Date.now() - queryTime)
        taskState.addressWatching = false
      })
      .catch(() => {
        taskState.addressWatching = false
      })
    deferredAddressSub.promise.catch(() => {
      taskState.addressWatching = false
    })
    serverStates.watchAddresses(
      uri,
      addressSubscribeTasks.keys,
      deferredAddressSub
    )
    return true
  }

  // filled when transactions potentially changed (e.g. through new block notification)
  if (updateTransactionTasks.size > 0) {
    for (const [txId, task] of updateTransactionTasks.entries) {
      if (!task.processing && serverStates.serverCanGetTx(uri, txId)) {
        task.processing = true
        updateTransactionTasks.remove(txId)
        const updateTransactionTask = updateTransactions({ ...args, txId })
        // once resolved, add the txid to the server cache
        updateTransactionTask.deferred.promise
          .then(() => {
            serverState.txids.add(txId)
          })
          .catch(e => {
            throw e
          })
        return updateTransactionTask
      }
    }
    return true
  }

  // loop to get and process transaction history of single addresses, triggers setLookAhead
  for (const [address, task] of transactionTasks.entries) {
    if (!task.processing && serverStates.serverCanGetAddress(uri, address)) {
      task.processing = true

      transactionTasks.remove(address)

      // Fetch and process address UTXOs
      const wsTask = await processAddressTransactions({
        ...args,
        ...task,
        address
      })
      wsTask.deferred.promise
        .then(() => {
          serverState.addresses.add(address)
        })
        .catch(e => {
          throw e
        })
      return wsTask
    }
  }
}

interface UpdateTransactionsArgs extends CommonArgs {
  txId: string
}

const updateTransactions = (
  args: UpdateTransactionsArgs
): WsTask<ITransaction> => {
  const { emitter, walletTools, txId, pluginInfo, processor, taskState } = args
  const deferredITransaction = new Deferred<ITransaction>()
  deferredITransaction.promise
    .then(async (rawTx: ITransaction) => {
      // check if raw tx is still not confirmed, if so, don't change anything
      if (rawTx.blockHeight < 1) return
      // Create new tx from raw tx
      const tx = processRawTx({ ...args, tx: rawTx })
      // Remove any existing input utxos from the processor
      for (const input of tx.inputs) {
        await processor.removeUtxos([`${input.txId}_${input.outputIndex}`])
      }
      // Process and save new tx
      const processedTx = await processor.saveTransaction({
        tx
      })
      await transactionChanged({
        emitter,
        walletTools,
        processor,
        pluginInfo,
        tx: processedTx
      })
    })
    .catch(() => {
      taskState.updateTransactionTasks.add(txId, { processing: false })
    })
  return {
    ...transactionMessage(txId),
    cleaner: asITransaction,
    deferred: deferredITransaction
  }
}

const getTotalAddressCount = async (
  supportedFormats: CurrencyFormat[],
  processor: Processor
): Promise<number> => {
  let count = 0
  for (const format of supportedFormats) {
    const branches = getFormatSupportedBranches(format)
    for (const branch of branches) {
      const addressCount = processor.numAddressesByFormatPath({
        format,
        changeIndex: branch
      })
      count += addressCount
    }
  }
  return count
}

interface DeriveScriptAddressArgs {
  walletTools: UTXOPluginWalletTools
  engineInfo: EngineInfo
  processor: Processor
  format: CurrencyFormat
  taskState: TaskState
  script: string
}

interface DeriveScriptAddressReturn {
  address: string
  scriptPubkey: string
  redeemScript: string
}

const internalDeriveScriptAddress = async ({
  walletTools,
  engineInfo,
  processor,
  format,
  taskState,
  script
}: DeriveScriptAddressArgs): Promise<DeriveScriptAddressReturn> => {
  if (engineInfo.scriptTemplates == null) {
    throw new Error(
      `cannot derive script address ${script} without defined script template`
    )
  }

  const scriptTemplate = engineInfo.scriptTemplates[script]

  const path: AddressPath = {
    format,
    changeIndex: derivationLevelScriptHash(scriptTemplate),
    addressIndex: 0
  }

  // save the address to the processor and add it to the cache
  const { address, scriptPubkey, redeemScript } = walletTools.getScriptAddress({
    path,
    scriptTemplate
  })
  await processor.saveAddress(
    makeIAddress({ scriptPubkey, redeemScript, path })
  )
  taskState.addressSubscribeTasks.add(address, {
    path: {
      format: path.format,
      branch: path.changeIndex
    },
    processing: false
  })
  return { address, scriptPubkey, redeemScript }
}

interface GetFreshAddressArgs extends FormatArgs {}

interface GetFreshAddressReturn {
  address: string
  legacyAddress: string
}

const internalGetFreshAddress = async (
  args: GetFreshAddressArgs
): Promise<GetFreshAddressReturn> => {
  const { format, branch, walletTools, processor } = args

  const numAddresses = processor.numAddressesByFormatPath({
    format,
    changeIndex: branch
  })

  const path: AddressPath = {
    format,
    changeIndex: branch,
    // while syncing, we may hit negative numbers when only subtracting. Use the address at /0 in that case.
    addressIndex: Math.max(
      numAddresses - args.pluginInfo.engineInfo.gapLimit,
      0
    )
  }
  const { scriptPubkey } =
    (await processor.fetchAddress(path)) ??
    (await walletTools.getScriptPubkey(path))
  if (scriptPubkey == null) {
    throw new Error('Unknown address path')
  }
  return walletTools.scriptPubkeyToAddress({
    scriptPubkey,
    format
  })
}

interface ProcessAddressTxsArgs extends CommonArgs {
  processing: boolean
  page: number
  blockHeight: number
  path: ShortPath
  address: string
  uri: string
}

type AddressResponse = IAccountDetailsBasic &
  ITransactionDetailsPaginationResponse

const processAddressTransactions = async (
  args: ProcessAddressTxsArgs
): Promise<WsTask<AddressResponse>> => {
  const {
    address,
    page = 1,
    blockHeight,
    emitter,
    pluginInfo,
    processor,
    walletTools,
    path,
    taskState,
    serverStates,
    uri
  } = args

  const scriptPubkey = walletTools.addressToScriptPubkey(address)
  const addressData = await processor.fetchAddress(scriptPubkey)
  if (addressData == null) {
    throw new Error(`could not find address with script pubkey ${scriptPubkey}`)
  }

  const queryTime = Date.now()
  const deferredAddressResponse = new Deferred<AddressResponse>()
  deferredAddressResponse.promise
    .then(async (value: AddressResponse) => {
      serverStates.serverScoreUp(uri, Date.now() - queryTime)
      const { transactions = [], txs, unconfirmedTxs, totalPages } = value

      // If address is used and previously not marked as used, mark as used.
      const used = txs > 0 || unconfirmedTxs > 0
      if (!addressData.used && used && page === 1) {
        addressData.used = true
      }

      // Process and save the address's transactions
      for (const rawTx of transactions) {
        const tx = processRawTx({ ...args, tx: rawTx })
        const processedTx = await processor.saveTransaction({
          tx,
          scriptPubkey
        })
        await transactionChanged({
          emitter,
          walletTools,
          processor,
          pluginInfo,
          tx: processedTx
        })
      }

      // Halt on finishing the processing of address transaction until
      // we have progressed through all of the blockbook pages
      if (page < totalPages) {
        // Add the address back to the cache, incrementing the page
        taskState.transactionTasks.add(address, {
          path,
          processing: false,
          blockHeight,
          page: page + 1
        })
        return
      }

      // Update the lastQueriedBlockHeight for the address
      addressData.lastQueriedBlockHeight = blockHeight

      // Save/update the fully-processed address
      await processor.saveAddress(addressData)
      // Invoke the callback for when an address has been fully processed
      await args.onAddressChecked()
      // Call setLookAhead to update the lookahead
      await setLookAhead(args)
    })
    .catch(err => {
      // Log the error for debugging purposes without crashing the engine
      // This will cause frozen wallet syncs
      console.error(err.toString())
      console.log(err.stack)
    })
  return {
    ...addressMessage(address, {
      details: 'txs',
      from: addressData.lastQueriedBlockHeight,
      perPage: BLOCKBOOK_TXS_PER_PAGE,
      page
    }),
    deferred: deferredAddressResponse
  }
}

interface ProcessRawTxArgs extends CommonArgs {
  tx: ITransaction
}

const processRawTx = (args: ProcessRawTxArgs): IProcessorTransaction => {
  const {
    tx,
    pluginInfo: { coinInfo }
  } = args
  return {
    txid: tx.txid,
    hex: tx.hex,
    // Blockbook can return a blockHeight of -1 when the tx is pending in the mempool
    blockHeight: tx.blockHeight > 0 ? tx.blockHeight : 0,
    date: tx.blockTime,
    fees: tx.fees,
    inputs: tx.vin.map(input => ({
      txId: input.txid,
      outputIndex: input.vout, // case for tx `fefac8c22ba1178df5d7c90b78cc1c203d1a9f5f5506f7b8f6f469fa821c2674` no `vout` for input
      n: input.n,
      scriptPubkey: validScriptPubkeyFromAddress({
        address: input.addresses[0],
        coin: coinInfo.name
      }),
      amount: input.value
    })),
    outputs: tx.vout.map(output => ({
      n: output.n,
      scriptPubkey:
        output.hex ??
        validScriptPubkeyFromAddress({
          address: output.addresses[0],
          coin: coinInfo.name
        }),
      amount: output.value
    })),
    ourIns: [],
    ourOuts: [],
    ourAmount: '0'
  }
}

interface ProcessAddressUtxosArgs extends CommonArgs {
  processing: boolean
  path: ShortPath
  address: string
  uri: string
}

const processAddressUtxos = async (
  args: ProcessAddressUtxosArgs
): Promise<WsTask<IAccountUTXO[]>> => {
  const {
    address,
    walletTools,
    processor,
    taskState,
    path,
    serverStates,
    uri
  } = args
  const { utxoTasks, rawUtxoTasks } = taskState
  const queryTime = Date.now()
  const deferredIAccountUTXOs = new Deferred<IAccountUTXO[]>()
  deferredIAccountUTXOs.promise
    .then(async (utxos: IAccountUTXO[]) => {
      serverStates.serverScoreUp(uri, Date.now() - queryTime)
      const scriptPubkey = walletTools.addressToScriptPubkey(address)
      const addressData = await processor.fetchAddress(scriptPubkey)
      if (addressData == null || addressData.path == null) {
        return
      }
      for (const utxo of utxos) {
        rawUtxoTasks.add(JSON.stringify(utxo), {
          processing: false,
          requiredCount: utxos.length,
          path,
          // TypeScript yells otherwise
          address: { ...addressData, path: addressData.path }
        })
      }
    })
    .catch(() => {
      args.processing = false
      utxoTasks.add(address, {
        processing: args.processing,
        path
      })
    })
  return {
    ...addressUtxosMessage(address),
    cleaner: asAddressUtxos,
    deferred: deferredIAccountUTXOs
  }
}

interface ProcessUtxoTransactionArgs extends CommonArgs {
  scriptPubkey: string
  utxos: Set<IUTXO>
  path: ShortPath
}

const processUtxoTransactions = async (
  args: ProcessUtxoTransactionArgs
): Promise<void> => {
  const {
    utxos,
    processor,
    scriptPubkey,
    log,
    emitter,
    pluginInfo: { currencyInfo }
  } = args

  const currentUtxos = await processor.fetchUtxos({ scriptPubkey })
  const currentUtxoIds: string[] = []
  let oldBalance = '0'
  for (const utxo of currentUtxos) {
    if (utxo == null)
      throw new Error(
        'Unexpected undefined utxo when processing unspent transactions'
      )
    oldBalance = add(utxo.value, oldBalance)
    currentUtxoIds.push(utxo.txid)
  }
  await processor.removeUtxos(currentUtxoIds)

  let newBalance = '0'
  for (const utxo of Array.from(utxos)) {
    newBalance = add(utxo.value, newBalance)
    await processor.saveUtxo(utxo)
  }

  const diff = sub(newBalance, oldBalance)
  if (diff !== '0') {
    log('balance changed:', { scriptPubkey, diff })
    emitter.emit(
      EngineEvent.ADDRESS_BALANCE_CHANGED,
      currencyInfo.currencyCode,
      diff
    )

    // Update balances for address that have this scriptPubkey
    const address = await processor.fetchAddress(scriptPubkey)

    if (address == null) {
      throw new Error('address not found when processing UTXO transactions')
    }

    await processor.saveAddress({
      ...address,
      balance: newBalance,
      used: true
    })
  }
  await setLookAhead(args).catch(err => {
    log.error(err)
    throw err
  })
}

interface ProcessRawUtxoArgs extends FormatArgs {
  path: ShortPath
  requiredCount: number
  utxo: IAccountUTXO
  id: string
  address: IAddress
  uri: string
}

const processRawUtxo = async (
  args: ProcessRawUtxoArgs
): Promise<WsTask<ITransaction> | undefined> => {
  const {
    utxo,
    id,
    address,
    format,
    processor,
    path,
    taskState,
    requiredCount,
    serverStates,
    uri,
    log
  } = args
  const { rawUtxoTasks } = taskState
  let scriptType: ScriptTypeEnum
  let script: string
  let redeemScript: string | undefined

  // Function to call once we are finished
  const done = (): void =>
    taskState.addProcessedUtxoTask(path, address.scriptPubkey, requiredCount, {
      id,
      txid: utxo.txid,
      vout: utxo.vout,
      value: utxo.value,
      scriptPubkey: address.scriptPubkey,
      script,
      redeemScript,
      scriptType,
      blockHeight: utxo.height ?? -1,
      spent: false
    })

  switch (currencyFormatToPurposeType(format)) {
    case BIP43PurposeTypeEnum.Airbitz:
    case BIP43PurposeTypeEnum.Legacy:
      scriptType = ScriptTypeEnum.p2pkh
      if (address.redeemScript != null) {
        scriptType = ScriptTypeEnum.p2sh
        redeemScript = address.redeemScript
      }

      // Legacy UTXOs need the previous transaction hex as the script
      // If we do not currently have it, add it to the queue to fetch it
      {
        const [tx] = await processor.fetchTransactions({ txId: utxo.txid })
        if (tx == null) {
          const queryTime = Date.now()
          const deferredITransaction = new Deferred<ITransaction>()
          deferredITransaction.promise
            .then((rawTx: ITransaction) => {
              serverStates.serverScoreUp(uri, Date.now() - queryTime)
              const processedTx = processRawTx({ ...args, tx: rawTx })
              script = processedTx.hex
              // Only after we have successfully fetched the tx, set our script and call done
              done()
            })
            .catch(e => {
              // If something went wrong, add the UTXO back to the queue
              log('error in processed utxos cache, re-adding utxo to cache:', e)
              rawUtxoTasks.add(JSON.stringify(utxo), {
                processing: false,
                path,
                address,
                requiredCount
              })
            })
          return {
            ...transactionMessage(utxo.txid),
            deferred: deferredITransaction
          }
        } else {
          script = tx.hex
        }
      }

      break
    case BIP43PurposeTypeEnum.WrappedSegwit:
      scriptType = ScriptTypeEnum.p2wpkhp2sh
      script = address.scriptPubkey
      if (address.redeemScript == null) {
        throw new Error(
          'Address redeem script not defined, but required for p2sh wrapped segwit utxo processing'
        )
      }
      redeemScript = address.redeemScript

      break
    case BIP43PurposeTypeEnum.Segwit:
      scriptType = ScriptTypeEnum.p2wpkh
      script = address.scriptPubkey

      break
  }

  // Since we have everything, call done
  done()
}
