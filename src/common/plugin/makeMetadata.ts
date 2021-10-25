import * as bs from 'biggystring'
import { Disklet } from 'disklet'
import { EdgeLog } from 'edge-core-js/types'
import { makeMemlet } from 'memlet'

import AwaitLock from '../utxobased/engine/await-lock'
import { EngineEmitter, EngineEvent } from './makeEngineEmitter'
import { asLocalWalletMetadata, LocalWalletMetadata } from './types'

const metadataPath = `metadata.json`

interface MetadataConfig {
  disklet: Disklet
  emitter: EngineEmitter
  log: EdgeLog
}

export interface Metadata extends LocalWalletMetadata {
  clear: () => Promise<void>
}

export const makeMetadata = async (
  config: MetadataConfig
): Promise<Metadata> => {
  const { disklet, emitter, log } = config
  const memlet = makeMemlet(disklet)
  const lock = new AwaitLock()

  const instance: Metadata = {
    get balance() {
      return cache.balance
    },
    get lastSeenBlockHeight() {
      return cache.lastSeenBlockHeight
    },
    clear: async () => {
      await memlet.delete(metadataPath)
      const cleanCache = await resetMetadata()
      Object.assign(cache, cleanCache)
    }
  }

  emitter.on(
    EngineEvent.ADDRESS_BALANCE_CHANGED,
    async (currencyCode: string, balanceDiff: string) => {
      await lock.acquireAsync()
      try {
        cache.balance = bs.add(cache.balance, balanceDiff)
        emitter.emit(
          EngineEvent.WALLET_BALANCE_CHANGED,
          currencyCode,
          cache.balance
        )
        await setMetadata(cache)
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
      const metadata = await memlet.getJson(metadataPath)
      return asLocalWalletMetadata(metadata)
    } catch (err) {
      log.error(err)
      return await resetMetadata()
    }
  }

  const resetMetadata = async (): Promise<LocalWalletMetadata> => {
    const data: LocalWalletMetadata = {
      balance: '0',
      lastSeenBlockHeight: 0
    }
    await memlet.setJson(metadataPath, data)
    return data
  }

  const setMetadata = async (data: LocalWalletMetadata): Promise<void> => {
    await memlet.setJson(metadataPath, data)
  }

  const cache = await fetchMetadata()

  return instance
}
