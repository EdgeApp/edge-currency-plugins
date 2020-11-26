import * as bs from 'biggystring'

import { Emitter, EmitterEvent, EngineCurrencyInfo, LocalWalletMetadata } from '../../plugin/types'
import { Processor } from '../db/Processor'
import { BlockBook, INewTransactionResponse, ITransaction } from '../network/BlockBook'
import { Account } from '../../Account'
import { makePathFromString, Path, toPurposeType } from '../../Path'
import { IAddressPartial, IUTXO } from '../db/types'
import {
  addressToScriptPubkey,
  BIP43PurposeTypeEnum,
  scriptPubkeyToType,
  ScriptTypeEnum
} from '../keymanager/keymanager'
import { ProcessorTransaction } from '../db/Models/ProcessorTransaction'

interface UtxoEngineStateConfig {
  currencyInfo: EngineCurrencyInfo
  processor: Processor
  metadata: LocalWalletMetadata
  account: Account
  emitter: Emitter
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

  getFreshChangeAddress(): string

  markAddressUsed(address: string): Promise<void>
}

export function makeUtxoEngineState(config: UtxoEngineStateConfig): UtxoEngineState {
  const {
    currencyInfo,
    processor,
    metadata,
    account,
    emitter,
    network
  } = config

  const addressesToWatch: Set<string> = new Set()
  let progress: SyncProgress
  let freshReceiveIndex: number = 0
  let freshChangeIndex: number = 0

  async function processAccount(): Promise<void> {
    // Reset the progress count
    progress = {
      totalCount: 0,
      processedCount: 0,
      ratio: 0
    }

    const receivePath = account.path.clone().goTo(0, 0)
    const changePath = account.path.clone().goToChange(1)

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
      progress.totalCount++

      let address: IAddressPartial = await processor.fetchAddress(path.clone()) ?? {
        scriptPubKey: account.getScriptPubKey(path),
        networkQueryVal: 0,
        path: path.toString(true)
      }
      await calculateAddressBalance(address)
      processor.saveAddress(path.clone(), address, () => {
        processAddress(address)
      })

      gap = address.used ? 0 : gap + 1
      path.next()
    }
  }

  async function processAddress(address: IAddressPartial, andTransactions = true): Promise<void> {
    const path = makePathFromString(address.path)
    addressesToWatch.add(account.getAddress(path))
    network.watchAddresses(Array.from(addressesToWatch), onNewTransaction)

    new Promise(async (resolve) => {
      andTransactions && await processAddressTransactions(address)
      await processAddressUTXOs(address)
      await afterProcessAddress(address, path)
      resolve()
    })
  }

  async function afterProcessAddress(address: IAddressPartial, path: Path): Promise<void> {
    if (!address.used) {
      const path = makePathFromString(address.path)
      updateFreshIndex(path)
    }

    progress.processedCount++
    progress.ratio = progress.processedCount / progress.totalCount
    emitter.emit(EmitterEvent.ADDRESSES_CHECKED, progress.ratio)

    address.networkQueryVal = metadata.lastSeenBlockHeight + 1

    processor.updateAddress(path, address)
  }

  function updateFreshIndex(path: Path): void {
    if (path.change === 0 && path.index === freshReceiveIndex) {
      freshReceiveIndex++
    } else if (path.change === 1 && path.index === freshChangeIndex) {
      freshChangeIndex++
    }
  }

  async function calculateAddressBalance(address: IAddressPartial): Promise<void> {
    const addressStr = account.getAddressFromPathString(address.path)
    const accountDetails = await network.fetchAddress(addressStr)
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

  async function processAddressTransactions(address: IAddressPartial, page = 1): Promise<void> {
    const addressStr = account.getAddressFromPathString(address.path)
    const accountDetails = await network.fetchAddress(addressStr, {
      details: 'txs',
      from: address.networkQueryVal,
      page
    })

    for (const rawTx of accountDetails.transactions ?? []) {
      const tx = processRawTransaction(rawTx)
      processor.saveTransaction(tx)
    }

    if (accountDetails.page < accountDetails.totalPages) {
      await processAddressTransactions(address, ++page)
    }
  }

  async function processAddressUTXOs(address: IAddressPartial): Promise<void> {
    const oldUtxos = await processor.fetchUtxosByScriptPubKey(address.scriptPubKey)
    const oldUtxoMap = oldUtxos.reduce<{ [id: string]: IUTXO }>((obj, utxo) => ({
      ...obj,
      [utxo.id]: utxo
    }), {})
    const addressStr = account.getAddressFromPathString(address.path)
    const accountUtxos = await network.fetchAddressUtxos(addressStr)

    for (const { txid, vout, value, height = 0 } of accountUtxos) {
      const id = `${txid}_${vout}`

      // Any UTXOs listed in the oldUtxoMap after the for loop will be deleted from the database.
      // If we do not already know about this UTXO, lets process it and add it to the database.
      if (oldUtxoMap[id]) {
        delete oldUtxoMap[id]
        continue
      }

      const prevTx = await processor.fetchTransaction(txid)
      if (!prevTx) {
        throw new Error('Previous transaction does not exist for p2pkh UTXO')
      }

      const path = makePathFromString(address.path)
      const purposeType = toPurposeType(address.path)
      let scriptType = scriptPubkeyToType(prevTx.outputs[vout].scriptPubKey)
      let script: string
      let redeemScript: string | undefined
      switch (purposeType) {
        case BIP43PurposeTypeEnum.Legacy:
          script = prevTx.hex
          break
        case BIP43PurposeTypeEnum.WrappedSegwit:
          script = address.scriptPubKey
          redeemScript = account.getRedeemScript(path)
          break
        case BIP43PurposeTypeEnum.Segwit:
          script = address.scriptPubKey
          break
      }

      processor.saveUtxo({
        id,
        txid,
        vout,
        value,
        scriptPubKey: address.scriptPubKey,
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

  // TODO: watch transaction status in case it is dropped
  // TODO: fetch and watch a fresh address if one of our addresses in the tx was fresh (this was its only tx)
  async function onNewTransaction(response: INewTransactionResponse): Promise<void> {
    const tx = await processRawTransaction(response.tx)

    // Process any of addresses' balances from the transaction
    const ourInOuts: Array<{ scriptPubKey: string }> = []
    ourInOuts.push(...tx.ourIns.map((index: string) => tx.inputs[parseInt(index)]))
    ourInOuts.push(...tx.ourOuts.map((index: string) => tx.outputs[parseInt(index)]))
    for (const { scriptPubKey } of ourInOuts) {
      const pathStr = await processor.fetchAddressPathBySPubKey(
        scriptPubKey
      )
      if (pathStr) {
        const path = makePathFromString(pathStr)
        const address = await processor.fetchAddress(path)
        address && await processAddress(address, false)
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

  function processRawTransaction(rawTx: ITransaction): ProcessorTransaction {
    return new ProcessorTransaction({
      txid: rawTx.txid,
      hex: rawTx.hex,
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
  }

  return {
    async start(): Promise<void> {
      await processAccount()
        .catch(console.error)
    },

    async stop(): Promise<void> {
    },

    getFreshChangeAddress(): string {
      const path = account.path.clone()
      path.goTo(freshChangeIndex, 1)
      return account.getAddress(path)
    },

    async markAddressUsed(address: string) {
      const scriptPubKey = addressToScriptPubkey({
        address,
        addressType: account.addressType,
        network: account.networkType,
        coin: account.coinName
      })
      const pathStr = await processor.fetchAddressPathBySPubKey(scriptPubKey)
      if (!pathStr) {
        throw new Error('Invalid address: not stored in database')
      }

      const path = makePathFromString(pathStr)
      updateFreshIndex(path)
      processor.updateAddress(path, {
        used: true
      })
    }
  }
}
