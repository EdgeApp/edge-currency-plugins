import { clearMemletCache } from 'baselet'
import * as bs from 'biggystring'
import { Disklet, navigateDisklet } from 'disklet'
import { EdgeGetTransactionsOptions } from 'edge-core-js/types'
import { makeMemlet } from 'memlet'

import { unixTime } from '../../../util/unixTime'
import { AddressPath, ChangePath } from '../../plugin/types'
import { makeBaselets } from './Baselets'
import { addressPathToPrefix, TxIdByDate } from './Models/baselet'
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
  scriptPubkeys?: string[]
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
  fetchUtxos: (args: FetchUtxosArgs) => Promise<Array<IUTXO | undefined>>

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

  saveTransaction: (args: SaveTransactionArgs) => Promise<IProcessorTransaction>
  numTransactions: () => number
  removeTransaction: (txId: string) => Promise<void>
  fetchTransactions: (
    args: FetchTransactionArgs
  ) => Promise<Array<IProcessorTransaction | undefined>>

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
  numAddressesByFormatPath: (path: ChangePath) => number
  // get the last used address index for a specific format
  lastUsedIndexByFormatPath: (path: ChangePath) => Promise<number>
  fetchAddress: (args: AddressPath | string) => Promise<IAddress | undefined>
}

export async function makeProcessor(
  config: ProcessorConfig
): Promise<Processor> {
  const disklet = navigateDisklet(config.disklet, BASELET_DIR)
  let memlet = makeMemlet(disklet)
  let baselets = await makeBaselets({ storage: memlet }).catch(async error => {
    await memlet.delete('.')
    throw error
  })

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
      await memlet.onFlush.next().value
      await clearMemletCache()
      await disklet.delete('.')
      memlet = makeMemlet(disklet)
      baselets = await makeBaselets({ storage: memlet })
    },

    async dumpData(): Promise<DumpDataReturn[]> {
      type AllBases = typeof baselets.all
      const allBases: Array<AllBases[keyof AllBases]> = Object.values(
        baselets.all
      )
      return await Promise.all(
        allBases.map(async base => {
          return {
            databaseName: base.databaseName,
            data: (await base.dumpData()) as unknown
          }
        })
      )
    },

    async saveUtxo(utxo: IUTXO): Promise<void> {
      return await baselets.utxo(async tables => {
        const [utxoIds = []] = await tables.utxoIdsByScriptPubkey.query('', [
          utxo.scriptPubkey
        ])
        if (!utxoIds.includes(utxo.id)) {
          utxoIds.push(utxo.id)
          await tables.utxoIdsByScriptPubkey.insert(
            '',
            utxo.scriptPubkey,
            utxoIds
          )
        }

        await tables.utxoById.insert('', utxo.id, utxo)
      })
    },

    async removeUtxos(utxoIds: string[]): Promise<void> {
      return await baselets.utxo(async tables => {
        if (utxoIds.length === 0) return

        // To remove utxo from utxoIdsByScriptPubkey table:
        // 1. Create a map of scriptPubkeys to utxoIds
        // 2. Use the map to remove utxoIds from the utxoIdsByScriptPubkey table
        const utxos = (await tables.utxoById.query('', utxoIds)).filter(
          utxo => utxo != null
        ) as IUTXO[]
        const utxoIdsMap: { [scriptPubkey: string]: string[] } = {}
        for (const utxo of utxos) {
          utxoIdsMap[utxo.scriptPubkey] = [
            ...(utxoIdsMap[utxo.scriptPubkey] ?? []),
            utxo.id
          ]
        }
        for (const scriptPubkey of Object.keys(utxoIdsMap)) {
          const utxoIdsToRemove = utxoIdsMap[scriptPubkey]
          const [utxoIds = []] = await tables.utxoIdsByScriptPubkey.query('', [
            scriptPubkey
          ])

          for (const utxoIdToRemove of utxoIdsToRemove) {
            utxoIds.splice(utxoIds.indexOf(utxoIdToRemove), 1)
          }

          // Update utxoIds for entry in table, otherwise delete entry
          if (utxoIds.length > 0) {
            await tables.utxoIdsByScriptPubkey.insert('', scriptPubkey, utxoIds)
          } else {
            await tables.utxoIdsByScriptPubkey.delete('', [scriptPubkey])
          }
        }

        // Remove utxo utxoById table
        await tables.utxoById.delete('', utxoIds)
      })
    },

    async fetchUtxos(args): Promise<Array<IUTXO | undefined>> {
      const { scriptPubkey, utxoIds = [] } = args
      return await baselets.utxo(async tables => {
        if (scriptPubkey != null) {
          const [
            utxoIdsByScriptPubkey
          ] = await tables.utxoIdsByScriptPubkey.query('', [scriptPubkey])

          if (utxoIdsByScriptPubkey != null)
            utxoIds.push(...utxoIdsByScriptPubkey)

          // Exit early if no utxoIds are found by scriptPubkey
          if (utxoIds.length === 0) {
            return []
          }
        }

        // Return all UTXOs if no UTXO ids are specified
        if (utxoIds.length === 0) {
          const { data } = await tables.utxoById.dumpData('')
          return Object.values(data[''] ?? {})
        }

        return await tables.utxoById.query('', utxoIds)
      })
    },

    async saveTransaction(
      args: SaveTransactionArgs
    ): Promise<IProcessorTransaction> {
      const { scriptPubkeys = [], tx } = args
      return await baselets.tx(async tables => {
        // Check if the transaction already exists
        const processorTx = await tables.txById
          .query('', [tx.txid])
          .then(transactions => transactions[0])
          .catch(_ => undefined)

        // Use the existing transaction if it does exist.
        const transaction = processorTx ?? tx

        // Mark the used inputs with the provided script pubkey
        for (const scriptPubkey of scriptPubkeys) {
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
            txid: transaction.txid,
            blockHeight: transaction.blockHeight
          })
        } else {
          // Save tx by blockheight
          const txIdsByTransactionBlockHeight = await (
            await tables.txIdsByBlockHeight.query('', transaction.blockHeight)
          )
            .reverse()
            .map(({ txid: id }) => id)
          if (!txIdsByTransactionBlockHeight.includes(transaction.txid)) {
            await tables.txIdsByBlockHeight.insert('', {
              txid: transaction.txid,
              blockHeight: transaction.blockHeight
            })
          }
        }

        // Save transaction
        await tables.txById.insert('', transaction.txid, transaction)

        // Save index entry only for first transaction insert
        if (processorTx == null) {
          await tables.txIdsByDate.insert('', {
            txid: tx.txid,
            date: tx.date
          })
        }

        return transaction
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
    ): Promise<Array<IProcessorTransaction | undefined>> {
      const { blockHeightMax, txId, options } = args
      let { blockHeight } = args
      const txs: Array<IProcessorTransaction | undefined> = []
      await baselets.tx(async tables => {
        // Fetch transactions by id
        if (txId != null) {
          const txById = await tables.txById.query('', [txId])
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
            .map(({ txid: id }) => id)

          const txsById = await tables.txById.query('', txIdsByMinBlockHeight)
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
          let txData: TxIdByDate[]
          if (startEntries != null && startIndex != null) {
            txData = await tables.txIdsByDate.queryByCount(
              '',
              startEntries,
              startIndex
            )
          } else {
            txData = await tables.txIdsByDate.query(
              '',
              unixTime(startDate.getTime()),
              unixTime(endDate.getTime())
            )
          }
          const txIdsByOptions = await txData
            .reverse()
            .map(({ txid: id }) => id)

          const txsByOptions = await tables.txById.query('', txIdsByOptions)
          // Make sure only existing transactions are included
          txs.push(...txsByOptions.filter(tx => tx != null))
        }
      })
      return txs
    },

    async saveAddress(address: IAddress): Promise<void> {
      await baselets.address(async tables => {
        // This variable is used to update the scriptPubkeyByPath table.
        // The path table must be written after the address table because the
        // path table is an index of the address table.
        // This variable acts as a catch for that update to be done after the
        // address table is written.
        let indexTableUpdate:
          | { path: AddressPath; scriptPubkey: string }
          | undefined

        const [existingAddress] = await tables.addressByScriptPubkey.query('', [
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

          indexTableUpdate = {
            path: address.path,
            scriptPubkey: address.scriptPubkey
          }

          // check if this address is used and if so, whether it has a higher
          // last used index
          if (address.used || existingAddress?.used === true) {
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

        // Update routine:
        if (existingAddress != null) {
          // Only update the lastQueriedBlockHeight on the address if one was given and is greater than the existing value
          if (
            address.lastQueriedBlockHeight >
            existingAddress.lastQueriedBlockHeight
          ) {
            existingAddress.lastQueriedBlockHeight =
              address.lastQueriedBlockHeight
          }

          // Only update the lastQuery value if one was given and is greater than the existing value
          if (address.lastQuery > existingAddress.lastQuery) {
            existingAddress.lastQuery = address.lastQuery
          }

          // Only update the lastTouched value if one was given and is greater than the existing value
          if (address.lastTouched > existingAddress.lastTouched) {
            existingAddress.lastTouched = address.lastTouched
          }

          // Only update the balance field if we have a value here
          if (address.balance != null) {
            existingAddress.balance = address.balance
          }

          /*
          Only update the path field if one was given and the existing address
          currently does not have one. We never update paths for addresses, only
          insert paths when they're not present.

          NOTE: Addresses can be stored in the db without a path due to the
          `EdgeCurrencyEngine.addGapLimitAddresses` function. Once an address
          path is known, it should never be updated
          */
          if (address.path != null && existingAddress.path == null) {
            existingAddress.path = address.path
            indexTableUpdate = {
              path: existingAddress.path,
              scriptPubkey: existingAddress.scriptPubkey
            }
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

          // Update the address table:
          await tables.addressByScriptPubkey.insert(
            '',
            existingAddress.scriptPubkey,
            existingAddress
          )
        }

        // Insert routine:
        if (existingAddress == null) {
          await tables.addressByScriptPubkey.insert(
            '',
            address.scriptPubkey,
            address
          )
        }

        // Insert the path into the index table:
        if (indexTableUpdate != null) {
          await tables.scriptPubkeyByPath.insert(
            addressPathToPrefix(indexTableUpdate.path),
            indexTableUpdate.path.addressIndex,
            indexTableUpdate.scriptPubkey
          )
        }
      })
    },

    numAddressesByFormatPath(path: ChangePath): number {
      return baselets.all.scriptPubkeyByPath.length(addressPathToPrefix(path))
    },

    async lastUsedIndexByFormatPath(path: ChangePath): Promise<number> {
      const [addressIndex] = await baselets.address(async tables => {
        return await tables.lastUsedByFormatPath.query('', [
          addressPathToPrefix(path)
        ])
      })
      return addressIndex ?? -1
    },

    async fetchAddress(
      fetchAddressArg: AddressPath | string
    ): Promise<IAddress | undefined> {
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

        // return if the address by path was not found
        if (scriptPubkeyFromPath == null) return

        const [address] = await tables.addressByScriptPubkey.query('', [
          scriptPubkeyFromPath
        ])

        return address
      })
    }
  }
  return processor
}
