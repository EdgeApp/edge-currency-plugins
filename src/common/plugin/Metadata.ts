import { add } from 'biggystring'
import { EdgeLog, EdgeTxDatabase } from 'edge-core-js/types'

import { dataLayerTables, WALLET_META_KEY } from '../utxobased/db/DataLayer'
import AwaitLock from '../utxobased/engine/await-lock'
import { EngineEmitter, EngineEvent } from './EngineEmitter'
import { asLocalWalletMetadata, LocalWalletMetadata } from './types'
import { removeItem } from './utils'

interface MetadataConfig {
  /**
   * The wallet's own storage.
   *
   * This used to be a JSON file in `walletLocalDisklet`, which is the last
   * thing the engine kept there. It is still one document, and still rewritten
   * whole on every address balance change -- splitting `addressBalances` into
   * rows is a behavioural change, not a storage one, and belongs in its own
   * commit.
   */
  txDatabase: EdgeTxDatabase
  emitter: EngineEmitter
  log: EdgeLog
}

export interface Metadata {
  state: LocalWalletMetadata
  clear: () => Promise<void>
}

export const makeMetadata = async (
  config: MetadataConfig
): Promise<Metadata> => {
  const { txDatabase: db, emitter, log } = config
  await db.defineTables(dataLayerTables)
  const lock = new AwaitLock()

  const instance: Metadata = {
    get state() {
      return cache
    },
    clear: async () => {
      await db.removeRows([{ table: 'meta', keys: [WALLET_META_KEY] }])
      const cleanCache = await resetMetadata()
      Object.assign(cache, cleanCache)
    }
  }

  const updateWalletBalance = async (currencyCode: string): Promise<void> => {
    const cumulativeBalance = Object.values(cache.addressBalances).reduce(
      (sum, addressBalance) => add(sum, addressBalance),
      '0'
    )
    cache.balance = cumulativeBalance
    await setMetadata(cache)
    emitter.emit(
      EngineEvent.WALLET_BALANCE_CHANGED,
      currencyCode,
      cumulativeBalance
    )
  }

  emitter.on(
    EngineEvent.ADDRESS_BALANCE_CHANGED,
    async (
      currencyCode: string,
      addressBalanceChanges: Array<{ scriptPubkey: string; balance: string }>
    ) => {
      await lock.acquireAsync()
      try {
        addressBalanceChanges.forEach(({ scriptPubkey, balance }) => {
          if (balance === '0') {
            removeItem(cache.addressBalances, scriptPubkey)
          } else {
            cache.addressBalances[scriptPubkey] = balance
          }
        })

        await updateWalletBalance(currencyCode)
      } catch (err) {
        log.error(err)
      } finally {
        lock.release()
      }
    }
  )

  emitter.on(
    EngineEvent.BLOCK_HEIGHT_CHANGED,
    async (_uri: string, height: number) => {
      if (height > cache.lastSeenBlockHeight) {
        cache.lastSeenBlockHeight = height
        await setMetadata(cache)
      }
    }
  )

  const fetchMetadata = async (): Promise<LocalWalletMetadata> => {
    try {
      const [result] = await db.getRows([
        { table: 'meta', keys: [WALLET_META_KEY] }
      ])
      if (result.rows[0] == null) return await resetMetadata()
      return asLocalWalletMetadata(result.rows[0])
    } catch (err) {
      log.error(err)
      return await resetMetadata()
    }
  }

  const resetMetadata = async (): Promise<LocalWalletMetadata> => {
    const data: LocalWalletMetadata = {
      balance: '0',
      addressBalances: {},
      lastSeenBlockHeight: 0
    }
    await setMetadata(data)
    return data
  }

  const setMetadata = async (data: LocalWalletMetadata): Promise<void> => {
    await db.putRows([
      { table: 'meta', rows: [{ ...data, id: WALLET_META_KEY }] }
    ])
  }

  const cache = await fetchMetadata()

  return instance
}
