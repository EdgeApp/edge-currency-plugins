import { Mutex } from 'async-mutex'
import * as bs from 'biggystring'
import { Disklet } from 'disklet'

import { EngineEmitter, EngineEvent } from './makeEngineEmitter'
import { LocalWalletMetadata } from './types'

const metadataPath = `metadata.json`

interface MetadataConfig {
  disklet: Disklet
  emitter: EngineEmitter
}

interface Metadata extends LocalWalletMetadata {
  clear: () => Promise<void>
}

export const makeMetadata = async (
  config: MetadataConfig
): Promise<Metadata> => {
  const { disklet, emitter } = config

  const mutex = new Mutex()

  let cache: LocalWalletMetadata = await fetchMetadata(disklet)

  emitter.on(
    EngineEvent.ADDRESS_BALANCE_CHANGED,
    (currencyCode: string, balanceDiff: string) => {
      void mutex.runExclusive(async () => {
        cache.balance = bs.add(cache.balance, balanceDiff)
        emitter.emit(
          EngineEvent.WALLET_BALANCE_CHANGED,
          currencyCode,
          cache.balance
        )
        await setMetadata(disklet, cache)
      })
    }
  )

  emitter.on(EngineEvent.BLOCK_HEIGHT_CHANGED, (height: number) => {
    void mutex.runExclusive(async () => {
      cache.lastSeenBlockHeight = height
      await setMetadata(disklet, cache)
    })
  })

  return {
    get balance() {
      return cache.balance
    },
    get lastSeenBlockHeight() {
      return cache.lastSeenBlockHeight
    },
    clear: async () => {
      await disklet.delete(metadataPath)
      cache = await fetchMetadata(disklet)
    }
  }
}

const fetchMetadata = async (
  disklet: Disklet
): Promise<LocalWalletMetadata> => {
  try {
    const dataStr = await disklet.getText(metadataPath)
    return JSON.parse(dataStr)
  } catch {
    const data: LocalWalletMetadata = {
      balance: '0',
      lastSeenBlockHeight: 0
    }
    await setMetadata(disklet, data)
    return data
  }
}

const setMetadata = async (
  disklet: Disklet,
  data: LocalWalletMetadata
): Promise<void> => {
  await disklet.setText(metadataPath, JSON.stringify(data))
}
