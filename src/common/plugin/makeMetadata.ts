import { Mutex } from 'async-mutex'
import * as bs from 'biggystring'
import { Disklet } from 'disklet'
<<<<<<< HEAD
=======
import { makeMemlet, Memlet } from 'memlet'
>>>>>>> master

import { EngineEmitter, EngineEvent } from './makeEngineEmitter'
import { LocalWalletMetadata } from './types'

const metadataPath = `metadata.json`

interface MetadataConfig {
  disklet: Disklet
  emitter: EngineEmitter
}

<<<<<<< HEAD
interface Metadata extends LocalWalletMetadata {
=======
export interface Metadata extends LocalWalletMetadata {
>>>>>>> master
  clear: () => Promise<void>
}

export const makeMetadata = async (
  config: MetadataConfig
): Promise<Metadata> => {
  const { disklet, emitter } = config
<<<<<<< HEAD

  const mutex = new Mutex()

  let cache: LocalWalletMetadata = await fetchMetadata(disklet)
=======
  const memlet = makeMemlet(disklet)

  const mutex = new Mutex()

  let cache: LocalWalletMetadata = await fetchMetadata(memlet)
>>>>>>> master

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
<<<<<<< HEAD
        await setMetadata(disklet, cache)
=======
        await setMetadata(memlet, cache)
>>>>>>> master
      })
    }
  )

  emitter.on(EngineEvent.BLOCK_HEIGHT_CHANGED, (height: number) => {
    void mutex.runExclusive(async () => {
<<<<<<< HEAD
      cache.lastSeenBlockHeight = height
      await setMetadata(disklet, cache)
=======
      if (height > cache.lastSeenBlockHeight) {
        cache.lastSeenBlockHeight = height
        await setMetadata(memlet, cache)
      }
>>>>>>> master
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
<<<<<<< HEAD
      await disklet.delete(metadataPath)
      cache = await fetchMetadata(disklet)
=======
      await memlet.delete(metadataPath)
      cache = await fetchMetadata(memlet)
>>>>>>> master
    }
  }
}

<<<<<<< HEAD
const fetchMetadata = async (
  disklet: Disklet
): Promise<LocalWalletMetadata> => {
  try {
    const dataStr = await disklet.getText(metadataPath)
=======
const fetchMetadata = async (memlet: Memlet): Promise<LocalWalletMetadata> => {
  try {
    const dataStr = await memlet.getJson(metadataPath)
>>>>>>> master
    return JSON.parse(dataStr)
  } catch {
    const data: LocalWalletMetadata = {
      balance: '0',
      lastSeenBlockHeight: 0
    }
<<<<<<< HEAD
    await setMetadata(disklet, data)
=======
    await setMetadata(memlet, data)
>>>>>>> master
    return data
  }
}

const setMetadata = async (
<<<<<<< HEAD
  disklet: Disklet,
  data: LocalWalletMetadata
): Promise<void> => {
  await disklet.setText(metadataPath, JSON.stringify(data))
=======
  memlet: Memlet,
  data: LocalWalletMetadata
): Promise<void> => {
  await memlet.setJson(metadataPath, JSON.stringify(data))
>>>>>>> master
}
