import * as bs from 'biggystring'

import { Path } from '../../Account/Path'
import { PrivateAccount } from '../../Account/PrivateAccount'
import { EngineCurrencyInfo } from '../../plugin/CurrencyEngine'
import { IAddress, IAddressOptional, IAddressPartial, IAddressRequired } from '../db/Models/Address'
import { ProcessorTransaction } from '../db/Models/ProcessorTransaction'
import { IUTXO, UTXO } from '../db/Models/UTXO'
import { Processor } from '../db/Processor'
import { addressToScriptPubkey } from '../keymanager/keymanager'
import { BlockBook, INewTransactionResponse, ITransaction as IBlockBookTransaction } from '../network/BlockBook'

interface UtxoEngineStateConfig {
  currencyInfo: EngineCurrencyInfo
  processor: Processor
  account: PrivateAccount
}

interface SyncProgress {
  totalCount: number
  processedCount: number
  ratio: number
}

export class UtxoEngineState implements UtxoEngineStateConfig {
  public readonly currencyInfo: EngineCurrencyInfo
  public readonly processor: Processor
  public readonly network: BlockBook
  public readonly account: PrivateAccount

  private readonly progress: SyncProgress
  private readonly addressesToWatch: Set<string> = new Set()
  private scriptPubKeysToProcess: Promise<any> = Promise.resolve()
  private freshReceiveIndex: number = 0
  private freshChangeIndex: number = 0

  constructor(config: UtxoEngineStateConfig) {
    this.currencyInfo = config.currencyInfo
    this.processor = config.processor
    this.account = config.account

    this.network = new BlockBook()

    const { gapLimit } = config.currencyInfo
    this.progress = {
      totalCount: gapLimit + gapLimit, // spend + change accounts
      processedCount: 0,
      ratio: 0
    }
  }

  public async load() {
    await this.network.connect()
  }

  public async start(): Promise<void> {
    const receivePath = this.account.path.clone().goTo(0, true)
    const changePath = this.account.path.clone().goTo(0, false)

    const [ receiveAddresses, changeAddresses ] = await Promise.all([
      this.processor.fetchAddressesByPath(receivePath),
      this.processor.fetchAddressesByPath(changePath)
    ])
    const addresses = receiveAddresses.concat(changeAddresses)
    if (addresses.length > this.progress.totalCount)
      this.progress.totalCount = addresses.length

    for (const address of addresses) {
      await this._processAddress(address)
    }

    const { gapLimit } = this.currencyInfo
    const receiveGapIndexStart = receiveAddresses.length - this.freshReceiveIndex
    const changeGapIndexStart = changeAddresses.length - this.freshChangeIndex
    if (receiveGapIndexStart < gapLimit) {
      await this._processAccountGapFromPath(receivePath.goTo(receiveGapIndexStart))
    }
    // TODO: Process gap limit for change path?
    if (receiveGapIndexStart < gapLimit) {
      await this._processAccountGapFromPath(changePath.goTo(changeGapIndexStart))
    }
  }

  public async stop(): Promise<void> {
    // TODO: stop processing information. save state?
  }

  private async _processAccountGapFromPath(path: Path): Promise<void> {
    const { gapLimit } = this.currencyInfo
    let gap = path.index
    while (gap < gapLimit) {
      const address = await this._processAddress({
        address: this.account.getAddress(path),
        scriptPubKey: this.account.getScriptPubKey(path),
        networkQueryVal: 0,
        path: path.toString(true)
      })

      if (address.used) {
        this.progress.totalCount++
      }

      gap = address.used ? 0 : gap + 1
      path.next()
    }
  }

  private _processAddress(address: IAddressPartial, andTransactions = true): Promise<IAddress> {
    this.scriptPubKeysToProcess = this.scriptPubKeysToProcess.then(async () => {
      console.log(address.path)
      await this._calculateAddressBalance(address)
      await this._addAddress(address)
      await this._processAddressUTXOs(address)

      if (andTransactions)
        await this._processAddressTransactions(address)

      await this._afterProcessAddress(address)

      return address
    })
    return this.scriptPubKeysToProcess
  }

  private async _afterProcessAddress(address: IAddressPartial) {
    if (!address.used) {
      const path = Path.fromString(address.path)
      if (path.external) {
        if (this.freshReceiveIndex === 0) {
          this.freshReceiveIndex = path.index
        }
      } else {
        if (this.freshChangeIndex === 0) {
          this.freshChangeIndex = path.index
        }
      }
    }

    this.progress.processedCount++
    this.progress.ratio = this.progress.processedCount / this.progress.totalCount
    console.log(this.progress)
  }

  private async _calculateAddressBalance(address: IAddressPartial) {
    const accountDetails = await this.network.fetchAddress(address.address)
    address.used = accountDetails.txs > 0 || accountDetails.unconfirmedTxs > 0
    address.balance = bs.add(
      accountDetails.balance,
      accountDetails.unconfirmedBalance
    )
  }

  private async _processAddressTransactions(address: IAddressPartial, page = 1) {
    const accountDetails = await this.network.fetchAddress(address.address, {
      details: 'txs',
      from: address.networkQueryVal,
      page
    })

    for (const rawTx of accountDetails.transactions ?? []) {
      const tx = await this.processor.fetchTransaction(rawTx.txid) ?? await this._processRawTransaction(rawTx)


      // let the processor process the transaction and update our reference
      await this.processor.addTransaction(tx)

      await this.processor.updateAddress(Path.fromString(address.path), {
        networkQueryVal: tx.blockHeight
      })
    }

    if (accountDetails.page < accountDetails.totalPages) {
      await this._processAddressTransactions(address, ++page)
    }
  }

  private async _processAddressUTXOs(address: IAddressPartial) {
    const oldUtxos = await this.processor.fetchUtxos(address.scriptPubKey)
    const oldUtxoMap: IUTXOMap = { lastIndex: 0, array: oldUtxos, map: {} }
    const accountUtxos = await this.network.fetchAddressUtxos(address.address)
    for (const accountUtxo of accountUtxos) {
      const utxo = new UTXO({
        txId: accountUtxo.txid,
        index: accountUtxo.vout,
        value: accountUtxo.value,
        scriptPubKey: address.scriptPubKey,
        blockHeight: accountUtxo.height ?? 0
      })
      const found = includesUtxo(utxo, oldUtxoMap)
      if (found) {
        oldUtxoMap.array.splice(oldUtxoMap.lastIndex, 1)
      } else {
        await this.processor.addUTXO(utxo)
      }
    }

    for (const oldUtxo of oldUtxoMap.array) {
      await this.processor.removeUtxo(oldUtxo)
    }
  }

  private async _addAddress(data: IAddressRequired & IAddressOptional) {
    if (this.addressesToWatch.has(data.address)) return

    this.addressesToWatch.add(data.address)
    this.network.watchAddresses(
      Array.from(this.addressesToWatch),
      this._onNewTransaction.bind(this)
    )

    const path = Path.fromString(data.path)
    await this.processor.saveAddress(path, data)
  }

  // TODO: watch transaction status in case it is dropped
  // TODO: fetch and watch a fresh address if one of our addresses in the tx was fresh (this was its only tx)
  private async _onNewTransaction(response: INewTransactionResponse) {
    const tx = await this._processRawTransaction(response.tx)

    // Process any of addresses' balances from the transaction
    const ourInOuts: Array<{ scriptPubKey: string }> = []
    ourInOuts.push(...tx.ourIns.map((index) => tx.inputs[index]))
    ourInOuts.push(...tx.ourOuts.map((index) => tx.outputs[index]))
    for (const { scriptPubKey } of ourInOuts) {
      const pathStr = await this.processor.fetchAddressPathBySPubKey(
        scriptPubKey
      )
      if (pathStr) {
        const path = Path.fromString(pathStr)
        const address = await this.processor.fetchAddress(path)
        if (address) {
          await this._processAddress(address, false)
          await this.processor.updateAddress(path, address)
        }
      }
    }
  }

  public addressToScriptPubKey(address: string): string {
    return addressToScriptPubkey({
      address,
      network: this.account.network,
      coin: this.account.coin
    })
  }

  private async _processRawTransaction(
    rawTx: IBlockBookTransaction
  ): Promise<ProcessorTransaction> {
    const tx = new ProcessorTransaction({
      txid: rawTx.txid,
      blockHeight: rawTx.blockHeight,
      date: rawTx.blockTime,
      fees: rawTx.fees,
      inputs: rawTx.vin.map((input) => ({
        txId: input.txid,
        outputIndex: input.vout, // case for tx `fefac8c22ba1178df5d7c90b78cc1c203d1a9f5f5506f7b8f6f469fa821c2674` no `vout` for input
        scriptPubKey: this.addressToScriptPubKey(input.addresses[0]),
        amount: input.value
      })),
      outputs: rawTx.vout.map((output) => ({
        index: output.n,
        scriptPubKey:
          output.hex ?? this.addressToScriptPubKey(output.addresses[0]),
        amount: output.value
      })),
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    })
    return tx
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
