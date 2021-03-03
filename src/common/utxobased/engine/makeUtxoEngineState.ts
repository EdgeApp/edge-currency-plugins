import * as bs from 'biggystring'
import { EdgeTxidMap, EdgeFreshAddress } from 'edge-core-js'

import { AddressPath, EmitterEvent, EngineConfig, LocalWalletMetadata } from '../../plugin/types'
import { BlockBook, INewTransactionResponse, ITransaction } from '../network/BlockBook'
import { IAddress, IProcessorTransaction, IUTXO } from '../db/types'
import { BIP43PurposeTypeEnum, ScriptTypeEnum } from '../keymanager/keymanager'
import { Processor } from '../db/makeProcessor'
import { UTXOPluginWalletTools } from './makeUtxoWalletTools'
import { getCurrencyFormatFromPurposeType, validScriptPubkeyFromAddress, getPurposeTypeFromKeys, getWalletFormat  } from './utils'

interface SyncProgress {
  totalCount: number
  processedCount: number
  ratio: number
}

export interface UtxoEngineState {
  start(): Promise<void>

  stop(): Promise<void>

  getFreshAddress(branch?: number): EdgeFreshAddress

  markAddressUsed(address: string): Promise<void>
}

export interface UtxoEngineStateConfig extends EngineConfig {
  walletTools: UTXOPluginWalletTools
  processor: Processor
  blockBook: BlockBook
  metadata: LocalWalletMetadata
}

export function makeUtxoEngineState(config: UtxoEngineStateConfig): UtxoEngineState {
  const {
    network,
    currencyInfo,
    walletInfo,
    walletTools,
    options: {
      emitter
    },
    processor,
    blockBook,
    metadata
  } = config

  const addressesToWatch: Set<string> = new Set()
  let progress: SyncProgress
  let freshReceiveIndex: number = 0
  let freshChangeIndex: number = 0
  blockBook.watchBlocks(onNewBlock)

  async function processAccount(): Promise<void> {
    // Reset the progress count
    progress = {
      totalCount: 0,
      processedCount: 0,
      ratio: 0
    }

    const receivePath: AddressPath = {
      format: getWalletFormat(walletInfo),
      changeIndex: 0,
      addressIndex: 0
    }
    const changePath: AddressPath = {
      format: getWalletFormat(walletInfo),
      changeIndex: 1,
      addressIndex: 0
    }

    const [ receiveAddresses, changeAddresses ] = await Promise.all([
      processor.fetchAddressesByPath(receivePath),
      processor.fetchAddressesByPath(changePath)
    ])
    const addresses = receiveAddresses.concat(changeAddresses)
    progress.totalCount += addresses.length

    for (const address of addresses) {
      if (!address) {
        throw new Error('Expected address missing from the database')
      }
      await processAddress(address)
    }

    const receiveGapIndexStart = receiveAddresses.length - freshReceiveIndex
    const changeGapIndexStart = changeAddresses.length - freshChangeIndex
    if (receiveGapIndexStart < currencyInfo.gapLimit) {
      receivePath.addressIndex = receiveGapIndexStart
      await processAccountGapFromPath(receivePath)
    }
    // TODO: Process gap limit for change path?
    if (changeGapIndexStart < currencyInfo.gapLimit) {
      changePath.addressIndex = changeGapIndexStart
      await processAccountGapFromPath(changePath)
    }
  }

  async function processAccountGapFromPath(path: AddressPath): Promise<void> {
    let gap = path.addressIndex
    while (gap < currencyInfo.gapLimit) {
      progress.totalCount++


      const scriptPubkey =
        await processor.fetchScriptPubkeyByPath(path) ??
        walletTools.getScriptPubkey(path).scriptPubkey
      const address: IAddress =
        await processor.fetchAddressByScriptPubkey(scriptPubkey) ??
        {
          path,
          scriptPubkey,
          networkQueryVal: 0,
          lastQuery: 0,
          lastTouched: 0,
          used: false,
          balance: '0'
        }
      await calculateAddressBalance(address)
      await processor.saveAddress(address)
      await processAddress(address)

      gap = address.used ? 0 : gap + 1
      path = {
        ...path,
        addressIndex: path.addressIndex + 1
      }
    }
  }

  async function processAddress(address: IAddress, andTransactions = true): Promise<void> {
    const addressStr = walletTools.getAddress(address.path!).address
    addressesToWatch.add(addressStr)
    blockBook.watchAddresses(Array.from(addressesToWatch), onNewTransaction)

    new Promise<void>(async (resolve) => {
      andTransactions && await processAddressTransactions(address)
      await processAddressUTXOs(address)
      await afterProcessAddress(address)
      resolve()
    })
  }

  async function afterProcessAddress(address: IAddress): Promise<void> {
    if (!address.used) {
      updateFreshIndex(address.path!)
    }

    progress.processedCount++
    progress.ratio = progress.processedCount / progress.totalCount
    emitter.emit(EmitterEvent.ADDRESSES_CHECKED, progress.ratio)

    address.networkQueryVal = metadata.lastSeenBlockHeight + 1

    await processor.updateAddressByScriptPubkey(address.scriptPubkey, address)
  }

  function updateFreshIndex(path: AddressPath): void {
    if (path.changeIndex === 0 && path.addressIndex === freshReceiveIndex) {
      freshReceiveIndex++
    } else if (path.changeIndex === 1 && path.addressIndex === freshChangeIndex) {
      freshChangeIndex++
    }
  }

  async function calculateAddressBalance(address: IAddress): Promise<void> {
    const addressStr = walletTools.getAddress(address.path!).address
    const accountDetails = await blockBook.fetchAddress(addressStr)
    address.used = accountDetails.txs > 0 || accountDetails.unconfirmedTxs > 0

    const oldBalance = address.balance ?? '0'
    address.balance = bs.add(
      accountDetails.balance,
      accountDetails.unconfirmedBalance
    )
    const diff = bs.sub(address.balance, oldBalance)
    if (diff !== '0') {
      metadata.balance = bs.add(metadata.balance, diff)
      emitter.emit(EmitterEvent.BALANCE_CHANGED, currencyInfo.currencyCode, metadata.balance)
    }
  }

  async function processAddressTransactions(address: IAddress, page = 1): Promise<void> {
    const addressStr = walletTools.getAddress(address.path!).address
    const accountDetails = await blockBook.fetchAddress(addressStr, {
      details: 'txs',
      from: address.networkQueryVal,
      page
    })

    const changeTxidMap: EdgeTxidMap = {}
    for (const rawTx of accountDetails.transactions ?? []) {
      const tx = processRawTransaction(rawTx)
      processor.saveTransaction(tx)

      changeTxidMap[tx.txid] = tx.date
    }
    if (accountDetails.transactions?.length ?? 0 > 0) {
      emitter.emit(EmitterEvent.TXIDS_CHANGED, changeTxidMap)
    }

    if (accountDetails.page < accountDetails.totalPages) {
      await processAddressTransactions(address, ++page)
    }
  }

  async function processAddressUTXOs(address: IAddress): Promise<void> {
    const oldUtxos = await processor.fetchUtxosByScriptPubkey(address.scriptPubkey)
    const oldUtxoMap = oldUtxos.reduce<{ [id: string]: IUTXO }>((obj, utxo) => ({
      ...obj,
      [utxo.id]: utxo
    }), {})
    const addressStr = walletTools.getAddress(address.path!).address
    const accountUtxos = await blockBook.fetchAddressUtxos(addressStr)

    for (const { txid, vout, value, height = 0 } of accountUtxos) {
      const id = `${txid}_${vout}`

      // Any UTXOs listed in the oldUtxoMap after the for loop will be deleted from the database.
      // If we do not already know about this UTXO, lets process it and add it to the database.
      if (oldUtxoMap[id]) {
        delete oldUtxoMap[id]
        continue
      }

      let scriptType: ScriptTypeEnum
      let script: string
      let redeemScript: string | undefined
      switch (getPurposeTypeFromKeys({ keys: walletInfo.keys })) {
        case BIP43PurposeTypeEnum.Legacy:
          script = (await fetchTransaction(txid)).hex
          scriptType = ScriptTypeEnum.p2pkh
          break
        case BIP43PurposeTypeEnum.WrappedSegwit:
          script = address.scriptPubkey
          scriptType = ScriptTypeEnum.p2wpkhp2sh
          redeemScript = walletTools.getScriptPubkey(address.path!).scriptPubkey
          break
        case BIP43PurposeTypeEnum.Segwit:
          script = address.scriptPubkey
          scriptType = ScriptTypeEnum.p2wpkh
          break
      }

      processor.saveUtxo({
        id,
        txid,
        vout,
        value,
        scriptPubkey: address.scriptPubkey,
        script,
        redeemScript,
        scriptType,
        blockHeight: height
      })
    }

    for (const id in oldUtxoMap) {
      processor.removeUtxo(oldUtxoMap[id])
    }
  }

  async function fetchTransaction(txid: string): Promise<IProcessorTransaction> {
    let tx = await processor.fetchTransaction(txid)
    if (!tx) {
      const rawTx = await blockBook.fetchTransaction(txid)
      tx = processRawTransaction(rawTx)
    }
    return tx
  }

  async function onNewBlock(): Promise<void> {
    const txIds = await processor.fetchTxIdsByBlockHeight(0)
    if (txIds === []) {
      return
    }
    for (const txId of txIds) {
      const rawTx = await blockBook.fetchTransaction(txId)
      const tx = processRawTransaction(rawTx)
      // check if tx is still not confirmed, if so, don't change anything
      if (tx.blockHeight < 1) {
        return
      }
      await processor.removeTxIdByBlockHeight(0, txId)
      await processor.insertTxIdByBlockHeight(tx.blockHeight, txId)
      await processor.updateTransaction(txId, tx)
    }
  }

  // TODO: watch transaction status in case it is dropped
  // TODO: fetch and watch a fresh address if one of our addresses in the tx was fresh (this was its only tx)
  async function onNewTransaction(response: INewTransactionResponse): Promise<void> {
    const tx = await processRawTransaction(response.tx)

    // Process any of addresses' balances from the transaction
    const ourInOuts: Array<{ scriptPubkey: string }> = []
    ourInOuts.push(...tx.ourIns.map((index: string) => tx.inputs[parseInt(index)]))
    ourInOuts.push(...tx.ourOuts.map((index: string) => tx.outputs[parseInt(index)]))
    for (const { scriptPubkey } of ourInOuts) {
      const address = await processor.fetchAddressByScriptPubkey(
        scriptPubkey
      )
      address && await processAddress(address, false)
    }
  }

  function processRawTransaction(rawTx: ITransaction): IProcessorTransaction {
    return {
      txid: rawTx.txid,
      hex: rawTx.hex,
      blockHeight: rawTx.blockHeight,
      date: rawTx.blockTime,
      fees: rawTx.fees,
      inputs: rawTx.vin.map((input) => ({
        txId: input.txid,
        outputIndex: input.vout, // case for tx `fefac8c22ba1178df5d7c90b78cc1c203d1a9f5f5506f7b8f6f469fa821c2674` no `vout` for input
        scriptPubkey: validScriptPubkeyFromAddress({
          address: input.addresses[0],
          coin: currencyInfo.network,
          network
        }),
        amount: input.value
      })),
      outputs: rawTx.vout.map((output) => ({
        index: output.n,
        scriptPubkey: output.hex ?? validScriptPubkeyFromAddress({
          address: output.addresses[0],
          coin: currencyInfo.network,
          network
        }),
        amount: output.value
      })),
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    }
  }

  return {
    async start(): Promise<void> {
      await processAccount()
        .catch(console.error)
    },

    async stop(): Promise<void> {
    },

    getFreshAddress(branch = 0): EdgeFreshAddress {
      const {
        address: publicAddress
      } = walletTools.getAddress({
        format: getWalletFormat(walletInfo),
        changeIndex: branch,
        addressIndex: freshChangeIndex
      })

      return {
        publicAddress
      }
    },

    async markAddressUsed(addressStr: string) {
      const scriptPubkey = walletTools.addressToScriptPubkey(addressStr)
      const address = await processor.fetchAddressByScriptPubkey(scriptPubkey)
      if (!address?.path) {
        throw new Error('Invalid address: not stored in database')
      }

      updateFreshIndex(address.path)
      await processor.updateAddressByScriptPubkey(scriptPubkey, {
        used: true
      })
    }
  }
}
