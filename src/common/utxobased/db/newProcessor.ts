// We have AddressTables, TransactionTables and UTXOTables

import { Disklet, navigateDisklet } from 'disklet'
import { EdgeGetTransactionsOptions } from 'edge-core-js'
import { clearMemletCache } from 'memlet'

import { AddressPath } from '../../plugin/types'
import { makeBaselets } from './makeBaselets'
import { addressPathToPrefix } from './Models/baselet'
import { IAddress, IProcessorTransaction, IUTXO } from './types'

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

export async function makeNewProcessor(
  config: ProcessorConfig
): Promise<NewProcessor> {
  const disklet = navigateDisklet(config.disklet, BASELET_DIR)
  let baselets = await makeBaselets({ disklet })

  const processor: NewProcessor = {
    async clearAll(): Promise<void> {
      await clearMemletCache()
      // why is this delay needed?
      await new Promise(resolve => setTimeout(resolve, 0))
      await disklet.delete('.')
      baselets = await makeBaselets({ disklet })
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
