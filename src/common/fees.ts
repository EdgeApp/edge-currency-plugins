import { Disklet } from 'disklet'
import { EdgeIo, EdgeLog, EdgeSpendInfo } from 'edge-core-js'
import { makeMemlet, Memlet } from 'memlet'

import { EngineCurrencyInfo, SimpleFeeSettings } from './plugin/types'

const FEES_PATH = 'fees.json'

interface MakeFeesConfig {
  disklet: Disklet
  currencyInfo: EngineCurrencyInfo
}

export interface Fees {
  start: () => Promise<void>
  stop: () => void
}

export const makeFees = async (config: MakeFeesConfig): Promise<Fees> => {
  const { currencyInfo } = config

  const memlet = makeMemlet(config.disklet)

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fees: SimpleFeeSettings = {
    ...currencyInfo.simpleFeeSettings,
    ...(await fetchCachedFees(memlet))
  }

  return {
    async start(): Promise<void> {
      return await Promise.resolve(undefined)
    },

    stop(): void {}
  }
}

const fetchCachedFees = async (memlet: Memlet): Promise<SimpleFeeSettings> =>
  await memlet.getJson(FEES_PATH).catch(() => ({})) // Return empty object on error

const cacheFees = async (
  memlet: Memlet,
  fees: SimpleFeeSettings
): Promise<void> => await memlet.setJson(FEES_PATH, fees)
