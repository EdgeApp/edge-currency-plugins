// We have AddressTables, TransactionTables and UTXOTables

import { clearMemletCache } from 'baselet'
import * as bs from 'biggystring'
import { Disklet, navigateDisklet } from 'disklet'
import { EdgeGetTransactionsOptions } from 'edge-core-js'

import { AddressPath } from '../../plugin/types'
import { makeBaselets } from './makeBaselets'
import {
  RANGE_ID_KEY,
  RANGE_KEY,
  TxIdsByDate,
  txIdsByDateRangeId,
  txIdsByDateRangeKey
} from './Models/baselet'
import {
  IAddress,
  IProcessorTransaction,
  ITransactionInput,
  ITransactionOutput,
  IUTXO
} from './types'

const BASELET_DIR = 'tables'

interface ProcessorConfig {
  disklet: Disklet
}

/* Transaction table interfaces */

interface InsertTransactionArgs {
  tx: IProcessorTransaction
  scriptPubkey: string
}

interface UpdateTransactionArgs {
  txId: string
  data: Pick<IProcessorTransaction, 'blockHeight'>
}

interface FetchTransactionArgs {
  blockHeight?: number
  blockHeightMax?: number
  txId?: string
  options?: EdgeGetTransactionsOptions
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
  txIdsByDate: index from date to txid, used for EdgeGetTransactionsOptions
  querying
  ------------------------------- 
  Used to store transactions. Needs to be updated for confirmation
  heights, and detecting used script pubkeys */

  insertTransaction: (args: InsertTransactionArgs) => Promise<void>
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
  lastUsedByFormatPath: index from path to last used address derivation index
  ------------------------------- 
  Used to store script pubkeys / addresses. Needs to be updated for 'used' flag
  and path */

  insertAddress: (args: IAddress) => Promise<void>
  // used to calculate total number of addresses
  numAddressesByFormatPath: (path: Omit<AddressPath, 'addressIndex'>) => number
  // get the last used address index for a specific format
  lastUsedScriptPubkeyByFormatPath: (
    path: Omit<AddressPath, 'addressIndex'>
  ) => Promise<string>
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

export async function makeNewProcessor(
  config: ProcessorConfig
): Promise<NewProcessor> {
  const disklet = navigateDisklet(config.disklet, BASELET_DIR)
  let baselets = await makeBaselets({ disklet })

  /**
   * Calculates the transaction value supplied (negative) or received (positive). In order to calculate
   * a value, the `ourIns` and `ourOuts` of the object must be populated with indices.
   * @param tx {IProcessorTransaction} A transaction object with `ourIns` and `ourOuts` populated
   */
  const calculateTxAmount = (tx: IProcessorTransaction): string => {
    interface TxIndexMap {
      [index: string]: ITransactionInput | ITransactionOutput
    }
    let ourAmount = '0'
    let txIndexMap: TxIndexMap = {}
    for (const input of tx.inputs) {
      txIndexMap[input.n.toString()] = input
    }
    for (const i of tx.ourIns) {
      const input = txIndexMap[i]
      ourAmount = bs.sub(ourAmount, input.amount)
    }
    txIndexMap = {}
    for (const output of tx.outputs) {
      txIndexMap[output.n.toString()] = output
    }
    for (const i of tx.ourOuts) {
      const output = txIndexMap[i]
      ourAmount = bs.add(ourAmount, output.amount)
    }
    return ourAmount
  }

  const processor: NewProcessor = {
    async clearAll(): Promise<void> {
      await clearMemletCache()
      // why is this delay needed?
      await new Promise(resolve => setTimeout(resolve, 0))
      await disklet.delete('.')
      baselets = await makeBaselets({ disklet })
    },

    async insertUtxo(_utxo: IUTXO): Promise<void> {
      return
    },

    async removeUtxos(_utxoIds: string[]): Promise<void> {
      return
    },

    async updateUtxo(_utxo: IUTXO): Promise<void> {
      return
    },

    async fetchUtxos(_utxoIds: string[]): Promise<IUTXO[]> {
      return []
    },

    async insertTransaction(args: InsertTransactionArgs): Promise<void> {
      const { scriptPubkey, tx } = args
      return await baselets.tx(async tables => {
        // Check if the transaction already exists
        const processorTx:
          | IProcessorTransaction
          | undefined = await tables.txById
          .query('', [tx.txid])
          .then(transactions => transactions[0])
          .catch(_ => undefined)
        if (processorTx == null) {
          await tables.txIdsByDate.insert('', {
            [txIdsByDateRangeId]: tx.txid,
            [txIdsByDateRangeKey]: tx.date
          })
        }
        // Use the existing transaction if it does exist.
        const transaction = processorTx ?? tx

        // Mark the used inputs with the provided script pubkey
        for (const input of transaction.inputs) {
          if (input.scriptPubkey === scriptPubkey) {
            if (!transaction.ourIns.includes(input.n.toString())) {
              transaction.ourIns.push(input.n.toString())
            }
          }
        }
        for (const output of transaction.outputs) {
          if (output.scriptPubkey === scriptPubkey) {
            if (!transaction.ourOuts.includes(output.n.toString())) {
              transaction.ourOuts.push(output.n.toString())
            }
          }
        }

        transaction.ourAmount = calculateTxAmount(transaction)

        // Save tx by blockheight
        const txIdsByTransactionBlockHeight = await (
          await tables.txIdsByBlockHeight.query('', transaction.blockHeight)
        )
          .reverse()
          .map(({ [RANGE_ID_KEY]: id }) => id)
        if (!txIdsByTransactionBlockHeight.includes(transaction.txid)) {
          await tables.txIdsByBlockHeight.insert('', {
            [RANGE_ID_KEY]: transaction.txid,
            [RANGE_KEY]: transaction.blockHeight
          })
        }

        // Save transaction
        await tables.txById.insert('', transaction.txid, transaction)
      })
    },

    numTransactions(): number {
      return baselets.all.txIdsByDate.size('')
    },

    async removeTransaction(_txId: string): Promise<void> {
      return
    },

    async updateTransaction(args: UpdateTransactionArgs): Promise<void> {
      const { data, txId } = args
      return await baselets.tx(async tables => {
        const [tx]: IProcessorTransaction[] = await tables.txById.query('', [
          txId
        ])
        if (data.blockHeight != null && data.blockHeight !== tx.blockHeight) {
          await tables.txIdsByBlockHeight.delete('', tx.blockHeight, txId)
          await tables.txIdsByBlockHeight.insert('', {
            [RANGE_ID_KEY]: txId,
            [RANGE_KEY]: data.blockHeight
          })

          tx.blockHeight = data.blockHeight
        }

        await tables.txById.insert('', txId, tx)
      })
    },

    async fetchTransactions(
      args: FetchTransactionArgs
    ): Promise<IProcessorTransaction[]> {
      const { blockHeightMax, txId, options } = args
      let { blockHeight } = args
      const txs: IProcessorTransaction[] = []
      await baselets.tx(async tables => {
        // Fetch transactions by id
        if (txId != null) {
          const txById: IProcessorTransaction[] = await tables.txById.query(
            '',
            [txId]
          )
          txs.push(...txById)
        }
        // Fetch transactions by min block height
        if (blockHeightMax != null && blockHeight == null) blockHeight = 0
        if (blockHeight != null) {
          const txIdsByMinBlockHeight = await (
            await tables.txIdsByBlockHeight.query(
              '',
              blockHeight,
              blockHeightMax
            )
          )
            .reverse()
            .map(({ [RANGE_ID_KEY]: id }) => id)

          const txsById: IProcessorTransaction[] = await tables.txById.query(
            '',
            txIdsByMinBlockHeight
          )
          txs.push(...txsById)
        }
        if (options != null) {
          const {
            startEntries,
            startIndex,
            startDate = new Date(0),
            endDate = new Date()
          } = options

          // Fetch transaction IDs ordered by date
          let txData: TxIdsByDate
          if (startEntries != null && startIndex != null) {
            txData = await tables.txIdsByDate.queryByCount(
              '',
              startEntries,
              startIndex
            )
          } else {
            txData = await tables.txIdsByDate.query(
              '',
              startDate.getTime(),
              endDate.getTime()
            )
          }
          const txIdsByOptions = await txData
            .reverse()
            .map(({ [txIdsByDateRangeId]: id }) => id)

          const txsByOptions = await tables.txById.query('', txIdsByOptions)
          // Make sure only existing transactions are included
          txs.push(...txsByOptions.filter(tx => tx != null))
        }
      })
      return txs
    },

    async insertAddress(_args: IAddress): Promise<void> {
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

    async updateAddress(_args: UpdateAddressArgs): Promise<void> {
      return
    },

    async fetchAddresses(_args: FetchAddressArgs): Promise<IAddress[]> {
      return []
    },

    async insertBlockHash(args: BlockHeightArgs): Promise<void> {
      const { height, blockHash, thresholdBlocks } = args
      return await baselets.block(async tables => {
        if (height - thresholdBlocks > 0)
          await tables.blockHashByBlockHeight.delete('', [
            (height - thresholdBlocks).toString()
          ])
        await tables.blockHashByBlockHeight.insert(
          '',
          height.toString(),
          blockHash
        )
      })
    },

    async fetchBlockHash(height: number): Promise<string[]> {
      return await baselets.block(
        async tables =>
          await tables.blockHashByBlockHeight.query('', [height.toString()])
      )
    }
  }
  return processor
}
