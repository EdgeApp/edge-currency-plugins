import { asObject, asString } from 'cleaners'
import { Disklet } from 'disklet'
import { EdgeIo, EdgeLog } from 'edge-core-js'
import { makeMemlet, Memlet } from 'memlet'

import { INFO_SERVER_URI } from './constants'
import { EngineCurrencyInfo, SimpleFeeSettings } from './plugin/types'

const FEES_PATH = 'fees.json'

interface MakeFeesConfig {
  disklet: Disklet
  currencyInfo: EngineCurrencyInfo
  io: EdgeIo
  log: EdgeLog
}

export interface Fees {
  start: () => Promise<void>
  stop: () => void
}

export const makeFees = async (config: MakeFeesConfig): Promise<Fees> => {
  const { currencyInfo, io, log } = config

  const memlet = makeMemlet(config.disklet)

  let fees: SimpleFeeSettings = {
    ...currencyInfo.simpleFeeSettings,
    ...(await fetchCachedFees(memlet))
  }

  return {
    async start(): Promise<void> {
      fees = {
        ...fees,
        ...(await fetchFeesFromEdge({ currencyInfo, io, log }))
      }

      await cacheFees(memlet, fees)
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

export const asInfoServerFees = asObject<SimpleFeeSettings>({
  lowFee: asString,
  standardFeeLow: asString,
  standardFeeHigh: asString,
  highFee: asString,

  // The amount of satoshis which will be charged the standardFeeLow
  standardFeeLowAmount: asString,
  // The amount of satoshis which will be charged the standardFeeHigh
  standardFeeHighAmount: asString
})

interface FetchFeesFromEdgeArgs {
  currencyInfo: EngineCurrencyInfo
  io: EdgeIo
  log: EdgeLog
}

const fetchFeesFromEdge = async (
  args: FetchFeesFromEdgeArgs
): Promise<Partial<SimpleFeeSettings>> => {
  const response = await args.io.fetch(
    `${INFO_SERVER_URI}/networkFees/${args.currencyInfo.currencyCode}`
  )
  if (!response.ok) throw new Error('Error fetching fees from InfoServer')

  const fees = await response.json()
  try {
    asInfoServerFees(fees)
    return fees
  } catch (err) {
    args.log.error('Invalid fee structure from InfoServer')
    return {}
  }
}
