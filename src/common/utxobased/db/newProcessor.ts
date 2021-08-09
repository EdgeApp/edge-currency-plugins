// We have AddressTables, TransactionTables and UTXOTables

import { EdgeGetTransactionsOptions } from 'edge-core-js'

import { AddressPath } from '../../plugin/types'
import { IAddress, IProcessorTransaction, IUTXO } from './types'

/* Transation table interfaces */

interface UpdateTransactionArgs {
  txid: string
  data: Pick<IProcessorTransaction, 'blockHeight'>
}

interface FetchTransactionArgs extends EdgeGetTransactionsOptions {
  blockHeightMin?: number
  scriptPubkey?: string
  txId?: string
}

/* Address table interfaces */

interface UpdateAddressArgs {
  scriptPubkey: string
  data: Partial<IAddress>
}

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

export interface Processor {
  clearAll: () => Promise<void>

  /* UTXO processing
  **********************
  Uses the following tables:
  ========================== 
  utxoById: main table
  -------------------------------
  Used to store UTXOs. Needs to be able to track UTXOs that are already used in
  a transaction, but not confirmed yet */

  insertUtxo: (utxo: IUTXO) => Promise<void>
  // remove either all UTXOs if the array is empty, or as selected from an array
  // of UTXO ids
  removeUtxos: (utxoIds: string[]) => Promise<void>
  // replaces a utxo with the same id, for example to set the 'used' flag
  updateUtxo: (utxo: IUTXO) => Promise<void>
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
  txsByDate: index from date to txid, used for EdgeGetTransactionsOptions
  querying
  ------------------------------- 
  Used to store transactions. Needs to be updated for confirmation
  heights, and detecting used script pubkeys */

  insertTransaction: (args: IProcessorTransaction) => Promise<void>
  numTransactions: () => number
  removeTransaction: (txId: string) => Promise<void>
  // update confirmation height
  updateTransaction: (args: UpdateTransactionArgs) => Promise<void>
  fetchTransactions: (
    args: FetchTransactionArgs
  ) => Promise<IProcessorTransaction[]>

  /* Address processing
  *********************
  Uses the following tables:
  ===============================
  addressByScriptPubkey: main table
  scriptPubkeyByPath: index from path to script pubkey
  lastUsedByPath: index from path to last used derivation index
  ------------------------------- 
  Used to store script pubkeys / addresses. Needs to be updated for 'used' flag
  and path */

  insertAddress: (args: IAddress) => Promise<void>
  // used to calculate total number of addresses
  numAddressesByFormatPath: (path: Omit<AddressPath, 'addressIndex'>) => number
  // get the last used address for a specific format
  lastUsedScriptPubkeyByFormatPath: (
    path: Omit<AddressPath, 'addressIndex'>
  ) => string
  // update to set the path or the used flag
  updateAddress: (args: UpdateAddressArgs) => Promise<void>
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
  insertBlockHash: (args: BlockHeightArgs) => Promise<void>
  fetchBlockHash: (height: number) => Promise<string[]>
}
