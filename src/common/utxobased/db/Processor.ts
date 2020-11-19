import { Disklet } from 'disklet'

import { Path } from '../../Path'
import { IAddress, IAddressOptional, IAddressPartial, IAddressRequired, IProcessorTransaction, IUTXO } from './types'
import { ProcessorTransaction } from './Models/ProcessorTransaction'
import { EmitterEvent } from '../../plugin/types'

interface ProcessorEmitter {
  emit(event: EmitterEvent.PROCESSOR_TRANSACTION_CHANGED, transaction: ProcessorTransaction): this
}

interface ProcessorConfig {
  disklet: Disklet
  emitter: ProcessorEmitter,
}

export interface Processor {
  fetchAddress(path: Path): Promise<IAddress | null>

  fetchAddressPathBySPubKey(scriptPubKey: string): Promise<string | null>

  hasSPubKey(scriptPubKey: string): Promise<boolean>

  fetchAddressesByPath(path: Path): Promise<IAddress[]>

  fetchAddressCountFromPathPartition(path: Path): number

  fetchScriptPubKeysByBalance(): Promise<Array<{ [RANGE_ID_KEY]: string; [RANGE_KEY]: string }>>

  saveAddress(path: Path, data: IAddressRequired & IAddressOptional, onComplete?: () => void): void

  updateAddress(path: Path, data: Partial<IAddress>): void

  updateAddressByScriptPubKey(scriptPubKey: string, data: Partial<IAddress>): void

  fetchTransaction(txId: string): Promise<ProcessorTransaction | null>

  fetchTransactionsByScriptPubKey(scriptHash: string): Promise<string[]>

  fetchTransactionsByDate(start: number, end?: number): Promise<ProcessorTransaction[]>

  saveTransaction(tx: ProcessorTransaction): void

  updateTransaction(txId: string, data: Pick<IProcessorTransaction, 'blockHeight'>): void

  dropTransaction(txId: string): void

  fetchBalance(path?: Path): Promise<string>

  fetchUtxo(id: string): Promise<IUTXO>

  fetchUtxos(scriptPubKey?: string): Promise<IUTXO[]>

  saveUtxo(utxo: IUTXO): void

  removeUtxo(utxo: IUTXO): void
}

export async function makeProcessor(config: ProcessorConfig): Promise<Processor> {
  const fns: Processor = {
    async fetchAddress(path: Path): Promise<IAddress | null> {

    },

    async fetchAddressPathBySPubKey(
      scriptPubKey: string
    ): Promise<string | null> {

    },

    async hasSPubKey(scriptPubKey: string): Promise<boolean> {

    },

    async fetchAddressesByPath(path: Path): Promise<IAddress[]> {

    },

    fetchAddressCountFromPathPartition(path: Path): number {

    },

    async fetchScriptPubKeysByBalance(): Promise<Array<{ [RANGE_ID_KEY]: string; [RANGE_KEY]: string }>> {

    },

    saveAddress(
      path: Path,
      data: IAddressPartial,
      onComplete?: () => void
    ): void {

    },

    updateAddress(
      path: Path,
      data: Partial<IAddress>,
      onComplete?: () => void
    ): void {

    },

    updateAddressByScriptPubKey(
      scriptPubKey: string,
      data: Partial<IAddress>
    ): void {

    },

    async fetchTransaction(txId: string): Promise<ProcessorTransaction | null> {

    },

    async fetchTransactionsByScriptPubKey(
      scriptHash: string
    ): Promise<string[]> {

    },

    async fetchTransactionsByDate(
      start: number,
      end?: number
    ): Promise<ProcessorTransaction[]> {

    },

    saveTransaction(tx: ProcessorTransaction): void {

    },

    updateTransaction(
      txId: string,
      data: Pick<IProcessorTransaction, 'blockHeight'>
    ): void {

    },

    // TODO: delete everything from db?
    dropTransaction(txId: string): void {

    },

    async fetchBalance(path?: Path): Promise<string> {

    },

    async fetchUtxo(id: string): Promise<IUTXO> {

    },

    async fetchUtxos(scriptPubKey?: string): Promise<IUTXO[]> {

    },

    saveUtxo(utxo: IUTXO) {

    },

    removeUtxo(utxo: IUTXO) {

    }
  }

  return fns
}
