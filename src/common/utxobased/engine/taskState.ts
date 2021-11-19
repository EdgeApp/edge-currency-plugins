import { CurrencyFormat } from '../../plugin/types'
import { Processor } from '../db/makeProcessor'
import { IAddress, IUTXO } from '../db/types'
import { UTXOPluginWalletTools } from './makeUtxoWalletTools'
import { makeTaskCache, TaskCache } from './taskCache'

export interface TaskState {
  addressWatching: boolean
  blockWatching: boolean
  addressSubscribeTasks: TaskCache<AddressSubscribeTask>
  utxoTasks: TaskCache<UtxosTask>
  rawUtxoTasks: TaskCache<RawUtxoTask>
  processedUtxoTasks: TaskCache<ProcessedUtxoTask>
  transactionTasks: TaskCache<TransactionTask>
  updateTransactionTasks: TaskCache<UpdateTransactionTask>
  clearTaskState: () => void
  addProcessedUtxoTask: (
    path: ShortPath,
    scriptPubkey: string,
    requiredCount: number,
    utxo: IUTXO
  ) => void
  addTransactionTask: (
    address: string,
    format: CurrencyFormat,
    branch: number,
    blockHeight: number
  ) => Promise<void>
}

export interface UpdateTransactionTask {
  processing: boolean
}
export interface AddressSubscribeTask {
  processing: boolean
  path: ShortPath
}

export interface UtxosTask {
  processing: boolean
  path: ShortPath
}

export interface ProcessedUtxoTask {
  processing: boolean
  full: boolean
  utxos: Set<IUTXO>
  path: ShortPath
}
export interface RawUtxoTask {
  processing: boolean
  path: ShortPath
  address: IAddress
  requiredCount: number
}
export interface TransactionTask {
  processing: boolean
  path: ShortPath
  page: number
  blockHeight: number
}

export interface ShortPath {
  format: CurrencyFormat
  branch: number
}

interface TaskStateConfig {
  walletTools: UTXOPluginWalletTools
  processor: Processor
}

export const makeTaskState = ({
  walletTools,
  processor
}: TaskStateConfig): TaskState => {
  return {
    addressWatching: false,
    blockWatching: false,
    addressSubscribeTasks: makeTaskCache(),
    transactionTasks: makeTaskCache(),
    utxoTasks: makeTaskCache(),
    rawUtxoTasks: makeTaskCache(),
    processedUtxoTasks: makeTaskCache(),
    updateTransactionTasks: makeTaskCache(),
    clearTaskState: function () {
      this.addressWatching = false
      this.blockWatching = false
      this.addressSubscribeTasks.clear()
      this.transactionTasks.clear()
      this.utxoTasks.clear()
      this.rawUtxoTasks.clear()
      this.processedUtxoTasks.clear()
      this.updateTransactionTasks.clear()
    },
    addProcessedUtxoTask(path, scriptPubkey, requiredCount, utxo) {
      const processedUtxos = this.processedUtxoTasks.get(scriptPubkey) ?? {
        utxos: new Set(),
        processing: false,
        path,
        full: false
      }
      processedUtxos.utxos.add(utxo)
      this.processedUtxoTasks.add(scriptPubkey, processedUtxos)
      processedUtxos.full = processedUtxos.utxos.size >= requiredCount
    },
    async addTransactionTask(address, format, branch, blockHeight) {
      // Fetch the blockHeight for the address from the database
      const scriptPubkey = walletTools.addressToScriptPubkey(address)

      if (blockHeight === 0) {
        const { lastQueriedBlockHeight = 0 } =
          (await processor.fetchAddress(scriptPubkey)) ?? {}
        blockHeight = lastQueriedBlockHeight
      }

      this.transactionTasks.add(address, {
        processing: false,
        path: {
          format,
          branch
        },
        page: 1, // Page starts on 1
        blockHeight
      })
    }
  }
}
