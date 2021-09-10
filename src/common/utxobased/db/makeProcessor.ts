import { clearMemletCache } from 'baselet'
import * as bs from 'biggystring'
import { Disklet, navigateDisklet } from 'disklet'
import { EdgeGetTransactionsOptions } from 'edge-core-js'

import { AddressPath } from '../../plugin/types'
import { makeBaselets } from './makeBaselets'
import {
  addressPathToPrefix,
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

interface FetchUtxosArgs {
  utxoIds?: string[]
  scriptPubkey?: string
}

/* Block height table interfaces */

interface BlockHeightArgs {
  height: number
  blockHash: string
  thresholdBlocks: number
}

interface DumpDataReturn {
  databaseName: string
  data: unknown
}

export interface Processor {
  clearAll: () => Promise<void>
  dumpData: () => Promise<DumpDataReturn[]>

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
  fetchUtxos: (args: FetchUtxosArgs) => Promise<IUTXO[]>

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
  lastUsedIndexByFormatPath: (
    path: Omit<AddressPath, 'addressIndex'>
  ) => Promise<number>
  fetchAddresses: (args: AddressPath | string) => Promise<IAddress>

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

export async function makeProcessor(
  config: ProcessorConfig
): Promise<Processor> {
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

  const processor: Processor = {
    async clearAll(): Promise<void> {
      await clearMemletCache()
      // why is this delay needed?
      await new Promise(resolve => setTimeout(resolve, 0))
      await disklet.delete('.')
      baselets = await makeBaselets({ disklet })
    },

    async dumpData(): Promise<DumpDataReturn[]> {
      const allBases = Object.values(baselets.all)
      return await Promise.all(
        allBases.map(async base => ({
          databaseName: base.databaseName,
          data: (await base.dumpData('')) as unknown
        }))
      )
    },

    async saveUtxo(utxo: IUTXO): Promise<void> {
      return await baselets.utxo(async tables => {
        await tables.utxoIdsByScriptPubkey.insert(
          '',
          utxo.scriptPubkey,
          utxo.id
        )

        await tables.utxoById.insert('', utxo.id, utxo)
      })
    },

    async removeUtxos(utxoIds: string[]): Promise<void> {
      return await baselets.utxo(async tables => {
        const utxos = await tables.utxoById.query('', utxoIds)
        await tables.utxoIdsByScriptPubkey.delete(
          '',
          utxos.map(utxo => (utxo != null ? utxo.scriptPubkey : undefined))
        )
        await tables.utxoById.delete('', utxoIds)
      })
    },

    async fetchUtxos(args): Promise<IUTXO[]> {
      const { scriptPubkey, utxoIds = [] } = args
      return await baselets.utxo(async tables => {
        if (scriptPubkey != null) {
          const utxoIdsByScriptPubkey = (
            await tables.utxoIdsByScriptPubkey.query('', [scriptPubkey])
          ).filter(utxoId => utxoId != null)

          utxoIds.push(...utxoIdsByScriptPubkey)

          // Return undefined as the UTXO if no utxoIds are found by scriptPubkey
          if (utxoIds.length === 0) {
            return [undefined]
          }
        }

        // Return all UTXOs if no UTXO ids are specified
        if (utxoIds.length === 0) {
          const dump = await tables.utxoById.dumpData('')
          return Object.values(dump.data)
        }

        return await tables.utxoById.query('', utxoIds)
      })
    },

    async saveTransaction(args: SaveTransactionArgs): Promise<void> {
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
        if (scriptPubkey != null) {
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
        }

        if (transaction.blockHeight !== tx.blockHeight) {
          // the transaction already exists, so delete it and re-insert at a different blockHeight
          await tables.txIdsByBlockHeight.delete(
            '',
            transaction.blockHeight,
            transaction.txid
          )
          transaction.blockHeight = tx.blockHeight
          await tables.txIdsByBlockHeight.insert('', {
            [RANGE_ID_KEY]: transaction.txid,
            [RANGE_KEY]: transaction.blockHeight
          })
        } else {
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

    async saveAddress(address: IAddress): Promise<void> {
      await baselets.address(async tables => {
        const [
          existingAddress
        ]: IAddress[] = await tables.addressByScriptPubkey.query('', [
          address.scriptPubkey
        ])

        // save to the path index if available
        if (address.path != null) {
          // check if the path already exists with a different script pubkey
          const [scriptPubkey] = await tables.scriptPubkeyByPath.query(
            addressPathToPrefix(address.path),
            address.path.addressIndex
          )
          if (scriptPubkey != null && scriptPubkey !== address.scriptPubkey)
            throw new Error(
              'Attempted to save address with an existing path, but different script pubkey'
            )

          await tables.scriptPubkeyByPath.insert(
            addressPathToPrefix(address.path),
            address.path.addressIndex,
            address.scriptPubkey
          )

          // check if this address is used and if so, whether it has a higher last used index
          if (address.used || existingAddress?.used) {
            let [lastUsed] = await tables.lastUsedByFormatPath.query('', [
              addressPathToPrefix(address.path)
            ])
            if (lastUsed == null) lastUsed = -1

            if (lastUsed < address.path.addressIndex) {
              await tables.lastUsedByFormatPath.insert(
                '',
                addressPathToPrefix(address.path),
                address.path.addressIndex
              )
            }
          }
        }

        if (existingAddress != null) {
          // Only update the networkQueryVal if one was given and is greater than the existing value
          if (address.networkQueryVal > existingAddress.networkQueryVal) {
            existingAddress.networkQueryVal = address.networkQueryVal
          }

          // Only update the lastQuery value if one was given and is greater than the existing value
          if (address.lastQuery > existingAddress.lastQuery) {
            existingAddress.lastQuery = address.lastQuery
          }

          // Only update the lastTouched value if one was given and is greater than the existing value
          if (address.lastTouched > existingAddress.lastTouched) {
            existingAddress.lastTouched = address.lastTouched
          }

          // Only update the balance field if one was given and does not equal the existing value
          if (address.balance !== existingAddress.balance) {
            existingAddress.balance = address.balance
          }

          // Only update the path field if one was given and currently does not have one
          // NOTE: Addresses can be stored in the db without a path due to the `EdgeCurrencyEngine.addGapLimitAddresses` function
          //  Once an address path is known, it should never be updated
          if (address.path != null && existingAddress.path == null) {
            existingAddress.path = address.path
            await tables.scriptPubkeyByPath.insert(
              addressPathToPrefix(address.path),
              address.path.addressIndex,
              address.scriptPubkey
            )
          }

          // Only update the used flag if one was given and is true
          if (address.used && !existingAddress.used) {
            existingAddress.used = true
          }

          // check if the lastUsed changed by the update
          if (existingAddress.path != null && existingAddress.used) {
            let [lastUsed] = await tables.lastUsedByFormatPath.query('', [
              addressPathToPrefix(existingAddress.path)
            ])
            if (lastUsed == null) lastUsed = -1

            if (lastUsed < existingAddress.path.addressIndex) {
              await tables.lastUsedByFormatPath.insert(
                '',
                addressPathToPrefix(existingAddress.path),
                existingAddress.path.addressIndex
              )
            }
          }
          await tables.addressByScriptPubkey.insert(
            '',
            existingAddress.scriptPubkey,
            existingAddress
          )
          return
        }
        await tables.addressByScriptPubkey.insert(
          '',
          address.scriptPubkey,
          address
        )
      })
    },

    numAddressesByFormatPath(path: Omit<AddressPath, 'addressIndex'>): number {
      return baselets.all.scriptPubkeyByPath.length(addressPathToPrefix(path))
    },

    async lastUsedIndexByFormatPath(
      path: Omit<AddressPath, 'addressIndex'>
    ): Promise<number> {
      const [addressIndex] = await baselets.address(async tables => {
        return await tables.lastUsedByFormatPath.query('', [
          addressPathToPrefix(path)
        ])
      })
      return addressIndex
    },

    async fetchAddresses(
      fetchAddressArg: AddressPath | string
    ): Promise<IAddress> {
      return await baselets.address(async tables => {
        if (typeof fetchAddressArg === 'string') {
          // if it is a string, it is a scriptPubkey
          const scriptPubkey = fetchAddressArg
          const [address] = await tables.addressByScriptPubkey.query('', [
            scriptPubkey
          ])
          return address
        }

        // since it is not a string, it has to be an AddressPath
        const path = fetchAddressArg
        // fetch addresses by provided path
        const [scriptPubkeyFromPath] = await tables.scriptPubkeyByPath.query(
          addressPathToPrefix(path),
          path.addressIndex
        )

        const [address] = await tables.addressByScriptPubkey.query('', [
          scriptPubkeyFromPath
        ])

        return address
      })
    },

    async saveBlockHash(args: BlockHeightArgs): Promise<void> {
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
