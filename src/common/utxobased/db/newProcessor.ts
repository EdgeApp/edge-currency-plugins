// We have AddressTables, TransactionTables and UTXOTables

import { Disklet } from 'disklet'
import { EdgeGetTransactionsOptions } from 'edge-core-js'

import { AddressPath } from '../../plugin/types'
import { IAddress, IProcessorTransaction, IUTXO } from './types'

interface ProcessorConfig {
  disklet: Disklet
}

/* Transaction table interfaces */

interface SaveTransactionArgs {
  tx: IProcessorTransaction
  scriptPubkey?: string
}

interface FetchTransactionArgs {
  blockHeight?: number
  blockHeightMax?: number
  txId?: string
  options?: EdgeGetTransactionsOptions
}

/* Address table interfaces */

interface FetchAddressArgs {
  path?: Omit<AddressPath, 'addressIndex'> | AddressPath
  scriptPubkey?: string
}

/* Block height table interfaces */

interface BlockHeightArgs {
  height: number
  blockHash: string
  thresholdBlocks: number
}

export interface NewProcessor {
  clearAll: () => Promise<void>

  /* UTXO processing
  **********************
  Uses the following tables:
  ========================== 
  utxoById: main table
  -------------------------------
  Used to store UTXOs. Needs to be able to track UTXOs that are already used in
  a transaction, but not confirmed yet */

  saveUtxo: (utxo: IUTXO) => Promise<void>
  // remove either all UTXOs if the array is empty, or as selected from an array
  // of UTXO ids
  removeUtxos: (utxoIds: string[]) => Promise<void>
  // fetch either all UTXOs if the array is empty or as selected from an array
  // of UTXO ids
  fetchUtxos: (utxoIds: string[]) => Promise<IUTXO[]>

  /* Transaction processing
  **********************
  Uses the following tables:
  ==========================
  txById: main table
  txsByScriptPubkey: index from script pubkey to txids, used to keep track of
  and discover used addresses
  txIdsByBlockHeight: index from block height to txid, used to change
  confirmation height for unconfirmed transactions
  txIdsByDate: index from date to txid, used for EdgeGetTransactionsOptions
  querying
  ------------------------------- 
  Used to store transactions. Needs to be updated for confirmation
  heights, and detecting used script pubkeys */

  saveTransaction: (args: SaveTransactionArgs) => Promise<void>
  numTransactions: () => number
  removeTransaction: (txId: string) => Promise<void>
  fetchTransactions: (
    args: FetchTransactionArgs
  ) => Promise<IProcessorTransaction[]>

  /* Address processing
  *********************
  Uses the following tables:
  ===============================
  addressByScriptPubkey: main table
  scriptPubkeyByPath: index from path to script pubkey
  lastUsedByFormatPath: index from path to last used address derivation index
  ------------------------------- 
  Used to store script pubkeys / addresses. Needs to be updated for 'used' flag
  and path */

  saveAddress: (args: IAddress) => Promise<void>
  // used to calculate total number of addresses
  numAddressesByFormatPath: (path: Omit<AddressPath, 'addressIndex'>) => number
  // get the last used address index for a specific format
  lastUsedScriptPubkeyByFormatPath: (
    path: Omit<AddressPath, 'addressIndex'>
  ) => Promise<string>
  fetchAddresses: (args: FetchAddressArgs) => Promise<IAddress[]>

  /* Block processing
  *******************
  Uses the following tables:
  ==========================
  blockHashByBlockHeight: main table
  ----------------------------------
  Used to store block height / block hash pairs. Saved until a certain threshold
  is reached */

  // insert a new block height / block hash pair. Evicts pairs further back in
  // history than the threshold blocks
  saveBlockHash: (args: BlockHeightArgs) => Promise<void>
  fetchBlockHash: (height: number) => Promise<string[]>
}

export async function makeNewProcessor(
  _config: ProcessorConfig
): Promise<NewProcessor> {
  const processor: NewProcessor = {
    async clearAll(): Promise<void> {
      //
    },

    async saveUtxo(_utxo: IUTXO): Promise<void> {
      return
    },

    async removeUtxos(_utxoIds: string[]): Promise<void> {
      return
    },

    async fetchUtxos(_utxoIds: string[]): Promise<IUTXO[]> {
      return []
    },

    async saveTransaction(_args: SaveTransactionArgs): Promise<void> {
      return
    },

    numTransactions(): number {
      return 0
    },

    async removeTransaction(_txId: string): Promise<void> {
      return
    },

    async fetchTransactions(
      _args: FetchTransactionArgs
    ): Promise<IProcessorTransaction[]> {
      return []
    },

    async saveAddress(_args: IAddress): Promise<void> {
      return
    },

    numAddressesByFormatPath(_path: Omit<AddressPath, 'addressIndex'>): number {
      return 0
    },

    async lastUsedScriptPubkeyByFormatPath(
      _path: Omit<AddressPath, 'addressIndex'>
    ): Promise<string> {
      return ''
    },

    async fetchAddresses(_args: FetchAddressArgs): Promise<IAddress[]> {
      return []
    },

    async saveBlockHash(_args: BlockHeightArgs): Promise<void> {
      return
    },

    async fetchBlockHash(_height: number): Promise<string[]> {
      return []
    }
  }
  return processor
}
