import * as bs from 'biggystring'
import { EdgeTransaction, EdgeTxidMap } from 'edge-core-js'
import { isEqual, cloneDeep } from 'lodash'

import { EngineCurrencyInfo, EngineEmitter, EngineEvent } from '../../plugin/types'
import { Processor } from '../db/Processor'
import { BlockBook, INewTransactionResponse, ITransaction, makeBlockBook } from '../network/BlockBook'
import { Account } from '../../Account'
import { makePathFromString, Path } from '../../Path'
import { IAddress, IAddressOptional, IAddressPartial, IAddressRequired, IUTXO } from '../db/types'
import { addressToScriptPubkey } from '../keymanager/keymanager'
import { ProcessorTransaction } from '../db/Models/ProcessorTransaction'

interface UtxoEngineStateConfig {
  currencyInfo: EngineCurrencyInfo
  processor: Processor
  account: Account
  emitter: EngineEmitter
  network: BlockBook
}

interface SyncProgress {
  totalCount: number
  processedCount: number
  ratio: number
}

export interface UtxoEngineState {
  start(): Promise<void>

  stop(): Promise<void>
}

export function makeUtxoEngineState(config: UtxoEngineStateConfig): UtxoEngineState {
  const {
    currencyInfo,
    processor,
    account,
    emitter,
    network
  } = config

  const progress: SyncProgress = {
    totalCount: currencyInfo.gapLimit + currencyInfo.gapLimit, // spend + change accounts
    processedCount: 0,
    ratio: 0
  }
  const addressesToWatch: Set<string> = new Set()
  let scriptPubKeysToProcess: Promise<any> = Promise.resolve()
  let freshReceiveIndex: number = 0
  let freshChangeIndex: number = 0

  async function processAccount() {
    const receivePath = account.path.clone().goTo(0, 0)
    const changePath = account.path.clone().goToChange(1)

    const [ receiveAddresses, changeAddresses ] = await Promise.all([
      processor.fetchAddressesByPath(receivePath),
      processor.fetchAddressesByPath(changePath)
    ])
    const addresses = receiveAddresses.concat(changeAddresses)
    if (addresses.length > progress.totalCount)
      progress.totalCount = addresses.length

    for (const address of addresses) {
      await processAddress(address)
    }

    const receiveGapIndexStart = receiveAddresses.length - freshReceiveIndex
    const changeGapIndexStart = changeAddresses.length - freshChangeIndex
    if (receiveGapIndexStart < currencyInfo.gapLimit) {
      await processAccountGapFromPath(receivePath.goTo(receiveGapIndexStart))
    }
    // TODO: Process gap limit for change path?
    if (receiveGapIndexStart < currencyInfo.gapLimit) {
      await processAccountGapFromPath(changePath.goTo(changeGapIndexStart))
    }
  }

  async function processAccountGapFromPath(path: Path): Promise<void> {
    let gap = path.index
    while (gap < currencyInfo.gapLimit) {
      console.log(path.toString(true), gap)
      const address = await processAddress({
        scriptPubKey: account.getScriptPubKey(path),
        networkQueryVal: 0,
        path: path.toString(true)
      })

      if (address.used) {
        progress.totalCount++
      }

      gap = address.used ? 0 : gap + 1
      path.next()
    }
  }

  async function processAddress(address: IAddressPartial, andTransactions = true): Promise<IAddress> {
    scriptPubKeysToProcess = scriptPubKeysToProcess.then(async () => {
      console.log(address.path)
      await calculateAddressBalance(address)
      await addAddress(address)
      await processAddressUTXOs(address)

      if (andTransactions)
        await processAddressTransactions(address)

      await afterProcessAddress(address)

      return address
    })
    return scriptPubKeysToProcess
  }

  async function afterProcessAddress(address: IAddressPartial) {
    if (!address.used) {
      const path = makePathFromString(address.path)
      if (path.change === 0) {
        if (freshReceiveIndex === 0) {
          freshReceiveIndex = path.index
        }
      } else {
        if (freshChangeIndex === 0) {
          freshChangeIndex = path.index
        }
      }
    }

    progress.processedCount++
    progress.ratio = progress.processedCount / progress.totalCount
    console.log(progress)

    emitter.emit(EngineEvent.ADDRESSES_CHECKED, progress.ratio)
  }

  async function calculateAddressBalance(address: IAddressPartial) {
    const addressStr = account.getAddressFromPathString(address.path)
    const accountDetails = await network.fetchAddress(addressStr)
    address.used = accountDetails.txs > 0 || accountDetails.unconfirmedTxs > 0
    address.balance = bs.add(
      accountDetails.balance,
      accountDetails.unconfirmedBalance
    )
  }

  async function processAddressTransactions(address: IAddressPartial, page = 1) {
    const addressStr = account.getAddressFromPathString(address.path)
    const accountDetails = await network.fetchAddress(addressStr, {
      details: 'txs',
      from: address.networkQueryVal,
      page
    })

    const changedTransactions: EdgeTransaction[] = []
    const changeTxidMap: EdgeTxidMap = {}
    for (const rawTx of accountDetails.transactions ?? []) {
      const tx = await processor.fetchTransaction(rawTx.txid) ?? await processRawTransaction(rawTx)
      const txClone = cloneDeep(tx)


      // let the processor process the transaction and update our reference
      await processor.saveTransaction(tx)

      // check if the processor updated our reference
      if (!isEqual(tx, txClone)) {
        const edgeTx = tx.toEdgeTransaction(currencyInfo.currencyCode)
        changedTransactions.push(edgeTx)
        changeTxidMap[tx.txid] = tx.date
      }

      await processor.updateAddress(makePathFromString(address.path), {
        networkQueryVal: tx.blockHeight
      })
    }

    if (changedTransactions.length > 0) {
      emitter.emit(EngineEvent.TRANSACTIONS_CHANGED, changedTransactions)
      emitter.emit(EngineEvent.TXIDS_CHANGED, changeTxidMap)
    }

    if (accountDetails.page < accountDetails.totalPages) {
      await processAddressTransactions(address, ++page)
    }
  }

  async function processAddressUTXOs(address: IAddressPartial) {
    const oldUtxos = await processor.fetchUtxos(address.scriptPubKey)
    const oldUtxoMap: IUTXOMap = { lastIndex: 0, array: oldUtxos, map: {} }
    const addressStr = account.getAddressFromPathString(address.path)
    const accountUtxos = await network.fetchAddressUtxos(addressStr)
    for (const accountUtxo of accountUtxos) {
      const utxo: IUTXO = {
        id: `${accountUtxo.txid}_${accountUtxo.vout}`,
        txId: accountUtxo.txid,
        index: accountUtxo.vout,
        value: accountUtxo.value,
        scriptPubKey: address.scriptPubKey,
        blockHeight: accountUtxo.height ?? 0
      }
      const found = includesUtxo(utxo, oldUtxoMap)
      if (found) {
        oldUtxoMap.array.splice(oldUtxoMap.lastIndex, 1)
      } else {
        await processor.saveUtxo(utxo)
      }
    }

    for (const oldUtxo of oldUtxoMap.array) {
      await processor.removeUtxo(oldUtxo)
    }
  }

  async function addAddress(data: IAddressRequired & IAddressOptional) {
    const addressStr = account.getAddressFromPathString(data.path)
    if (addressesToWatch.has(addressStr)) return

    addressesToWatch.add(addressStr)
    network.watchAddresses(Array.from(addressesToWatch), onNewTransaction)

    const path = makePathFromString(data.path)
    await processor.saveAddress(path, data)
  }

  // TODO: watch transaction status in case it is dropped
  // TODO: fetch and watch a fresh address if one of our addresses in the tx was fresh (this was its only tx)
  async function onNewTransaction(response: INewTransactionResponse) {
    const tx = await processRawTransaction(response.tx)

    // Process any of addresses' balances from the transaction
    const ourInOuts: Array<{ scriptPubKey: string }> = []
    ourInOuts.push(...tx.ourIns.map((index: number) => tx.inputs[index]))
    ourInOuts.push(...tx.ourOuts.map((index: number) => tx.outputs[index]))
    for (const { scriptPubKey } of ourInOuts) {
      const pathStr = await processor.fetchAddressPathBySPubKey(
        scriptPubKey
      )
      if (pathStr) {
        const path = makePathFromString(pathStr)
        const address = await processor.fetchAddress(path)
        if (address) {
          await processAddress(address, false)
          await processor.updateAddress(path, address)
        }
      }
    }
  }

  function addressToScriptPubKey(address: string): string {
    return addressToScriptPubkey({
      address,
      addressType: account.path.addressType,
      network: account.networkType,
      coin: account.coinName
    })
  }

  async function processRawTransaction(rawTx: ITransaction): Promise<ProcessorTransaction> {
    const tx = new ProcessorTransaction({
      txid: rawTx.txid,
      blockHeight: rawTx.blockHeight,
      date: rawTx.blockTime,
      fees: rawTx.fees,
      inputs: rawTx.vin.map((input) => ({
        txId: input.txid,
        outputIndex: input.vout, // case for tx `fefac8c22ba1178df5d7c90b78cc1c203d1a9f5f5506f7b8f6f469fa821c2674` no `vout` for input
        scriptPubKey: addressToScriptPubKey(input.addresses[0]),
        amount: input.value
      })),
      outputs: rawTx.vout.map((output) => ({
        index: output.n,
        scriptPubKey:
          output.hex ?? addressToScriptPubKey(output.addresses[0]),
        amount: output.value
      })),
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    })
    return tx
  }

  return {
    async start(): Promise<void> {
      await network.connect()
      await processAccount()
    },

    async stop(): Promise<void> {
      // TODO: stop processing information. save state?
    }
  }
}

interface IUTXOMap {
  lastIndex: number
  array: IUTXO[]
  map: { [id: string]: number }
}

function includesUtxo(utxo: IUTXO, utxoMap: IUTXOMap): boolean {
  const index = utxoMap.map[utxo.id]
  if (index != null) {
    utxoMap.lastIndex = index
    return true
  }

  for (; utxoMap.lastIndex < utxoMap.array.length; utxoMap.lastIndex++) {
    const oldUtxo = utxoMap.array[utxoMap.lastIndex]
    utxoMap.map[oldUtxo.id] = utxoMap.lastIndex

    if (utxo.id === oldUtxo.id) return true
  }

  return false
}
