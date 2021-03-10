import * as bs from 'biggystring'
import { asArray, asNumber, asObject, asString } from 'cleaners'
import { Disklet } from 'disklet'
import { EdgeIo, EdgeLog, EdgeSpendInfo, EdgeSpendTarget } from 'edge-core-js'
import { makeMemlet, Memlet } from 'memlet'

import {
  BYTES_TO_KB,
  INFO_SERVER_URI,
  LOW_FEE,
  MAX_FEE,
  MAX_HIGH_DELAY,
  MAX_STANDARD_DELAY,
  MIN_LOW_DELAY,
  MIN_STANDARD_DELAY
} from './constants'
import { EngineCurrencyInfo, FeeRates, SimpleFeeSettings } from './plugin/types'

type NetworkFeeOption = EdgeSpendInfo['networkFeeOption']

const FEES_PATH = 'fees.json'

interface MakeFeesConfig extends Common {
  disklet: Disklet
  currencyInfo: EngineCurrencyInfo
}

interface Common {
  io: EdgeIo
  log: EdgeLog
}

export interface Fees {
  start: () => Promise<void>
  stop: () => void
  getRate: (edgeSpendInfo: EdgeSpendInfo) => Promise<string>
}

export const makeFees = async (config: MakeFeesConfig): Promise<Fees> => {
  const { currencyInfo, io, log } = config

  const memlet = makeMemlet(config.disklet)

  let fees: SimpleFeeSettings = {
    ...currencyInfo.simpleFeeSettings,
    ...(await fetchCachedFees(memlet))
  }

  // The last time the fees were updated
  let timestamp = 0

  const updateVendorFees = async (): Promise<void> => {
    if (Date.now() - timestamp <= currencyInfo.feeUpdateInterval) return

    const vendorFees = await fetchFeesFromVendor({
      earnComFeeInfoServer: currencyInfo.earnComFeeInfoServer,
      mempoolSpaceFeeInfoServer: currencyInfo.mempoolSpaceFeeInfoServer,
      io,
      log
    })
    fees = { ...fees, ...vendorFees }
    timestamp = Date.now()

    await cacheFees(memlet, fees)
  }

  let vendorIntervalId: NodeJS.Timeout

  return {
    async start(): Promise<void> {
      fees = {
        ...fees,
        ...(await fetchFeesFromEdge({ currencyInfo, io, log }))
      }
      await updateVendorFees()
      vendorIntervalId = setInterval(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        updateVendorFees,
        currencyInfo.feeUpdateInterval
      )
    },

    stop(): void {
      clearInterval(vendorIntervalId)
    },

    async getRate(edgeSpendInfo: EdgeSpendInfo): Promise<string> {
      const {
        spendTargets,
        networkFeeOption,
        customNetworkFee = {},
        otherParams = {}
      } = edgeSpendInfo

      const requiredFeeRate =
        otherParams.paymentProtocolInfo?.merchant?.requiredFeeRate
      if (requiredFeeRate != null) {
        const rate = bs.add(
          bs.mul(bs.mul(requiredFeeRate, BYTES_TO_KB), '1.5'),
          '1'
        )
        return bs.toFixed(rate, 0, 0)
      }

      const rate = calcMinerFeePerByte(
        sumSpendTargets(spendTargets),
        fees,
        networkFeeOption,
        customNetworkFee[currencyInfo.customFeeSettings[0]]
      )
      return bs.mul(rate, BYTES_TO_KB)
    }
  }
}

const fetchCachedFees = async (memlet: Memlet): Promise<SimpleFeeSettings> =>
  await memlet.getJson(FEES_PATH).catch(() => ({})) // Return empty object on error

const cacheFees = async (
  memlet: Memlet,
  fees: SimpleFeeSettings
): Promise<void> => await memlet.setJson(FEES_PATH, fees)

const sumSpendTargets = (spendTargets: EdgeSpendTarget[]): string =>
  spendTargets.reduce((amount, { nativeAmount }) => {
    if (nativeAmount == null)
      throw new Error(`Invalid spend target amount: ${nativeAmount}`)
    return bs.add(amount, nativeAmount)
  }, '0')

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

interface FetchFeesFromVendorArgs extends Common {
  earnComFeeInfoServer?: string
  mempoolSpaceFeeInfoServer?: string
}

const fetchFeesFromVendor = async (
  args: FetchFeesFromVendorArgs
): Promise<Partial<SimpleFeeSettings>> => {
  let fees: Partial<SimpleFeeSettings> = {}

  if (args.earnComFeeInfoServer != null) {
    const earnComFees = await fetchFeesFromEarnCom({
      ...args,
      earnComFeeInfoServer: args.earnComFeeInfoServer
    })
    fees = { ...fees, ...earnComFees }
  }

  if (args.mempoolSpaceFeeInfoServer != null) {
    const mempoolFees = await fetchFeesFromMempoolSpace({
      ...args,
      mempoolSpaceFeeInfoServer: args.mempoolSpaceFeeInfoServer
    })
    fees = { ...fees, ...mempoolFees }
  }

  return fees
}

const asEarnComFee = asObject({
  minFee: asNumber,
  maxFee: asNumber,
  dayCount: asNumber,
  memCount: asNumber,
  minDelay: asNumber,
  maxDelay: asNumber,
  minMinutes: asNumber,
  maxMinutes: asNumber
})

type EarnComFees = ReturnType<typeof asEarnComFees>
export const asEarnComFees = asObject({
  fees: asArray(asEarnComFee)
})

interface FetchFeesFromEarnComArgs extends Common {
  earnComFeeInfoServer: string
}

/**
 * Fetches and calculates the FeeRates object from EarnCom
 * @param args
 * @returns {FeeRates}
 */
const fetchFeesFromEarnCom = async (
  args: FetchFeesFromEarnComArgs
): Promise<Partial<FeeRates>> => {
  const response = await args.io.fetch(args.earnComFeeInfoServer)
  if (!response.ok) throw new Error('Error fetching fees from EarnCom')

  const earnComFees: EarnComFees = await response.json()
  try {
    asEarnComFees(earnComFees)
  } catch (err) {
    args.log.error('Invalid fee structure from EarnCom')
    return {}
  }

  let highDelay = 999999
  let lowDelay = 0
  let highFee = MAX_FEE
  let standardFeeHigh
  let standardFeeLow = MAX_FEE
  let lowFee = MAX_FEE

  for (const fee of earnComFees.fees) {
    // If this is a zero fee estimate, then skip
    if (fee.maxFee < LOW_FEE || fee.minFee < LOW_FEE) {
      continue
    }
    // Set the lowFee if the delay in blocks is less than MAX_HIGH_DELAY.
    if (fee.maxDelay < MAX_HIGH_DELAY) {
      if (fee.maxFee < lowFee) {
        // Set the low fee if the current fee estimate is lower than the previously set low fee
        lowDelay = fee.maxDelay
        lowFee = fee.maxFee
      }
    }

    // Set the high fee only if the delay is MIN_LOW_DELAY
    if (fee.maxDelay <= MIN_LOW_DELAY) {
      if (fee.maxFee < highFee) {
        // Set the low fee if the current fee estimate is lower than the previously set high fee
        highFee = fee.minFee
        highDelay = fee.maxDelay
      }
    }
  }

  // Now find the standard fee range. We want the range to be within a maxDelay of
  // 3 to 18 blocks (about 30 mins to 3 hours). The standard fee at the low end should
  // have a delay less than the lowFee from above. The standard fee at the high end
  // should have a delay that's greater than the highFee from above.
  for (const fee of earnComFees.fees) {
    // If this is a zero fee estimate, then skip
    if (fee.maxFee === 0 || fee.minFee === 0) {
      continue
    }

    if (fee.maxDelay < lowDelay && fee.maxDelay <= MAX_STANDARD_DELAY) {
      if (standardFeeLow > fee.minFee) {
        standardFeeLow = fee.minFee
      }
    }
  }

  // Go backwards looking for lowest standardFeeHigh that:
  // 1. Is < highFee
  // 2. Has a blockDelay > highDelay
  // 3. Has a delay that is > MIN_STANDARD_DELAY
  // Use the highFee as the default standardHighFee
  standardFeeHigh = highFee
  for (let i = earnComFees.fees.length - 1; i >= 0; i--) {
    const fee = earnComFees.fees[i]

    if (i < 0) {
      break
    }
    // If this is a zero fee estimate, then skip
    if (fee.maxFee === 0 || fee.minFee === 0) {
      continue
    }
    // Dont ever go below standardFeeLow
    if (fee.maxFee <= standardFeeLow) {
      break
    }

    if (fee.maxDelay > highDelay) {
      standardFeeHigh = fee.maxFee
    }
    // If we have a delay that's greater than MIN_STANDARD_DELAY, then we're done.
    // Otherwise we'd be getting bigger delays and further reducing fees.
    if (fee.maxDelay >= MIN_STANDARD_DELAY) {
      break
    }
  }
  //
  // Check if we have a complete set of fee info.
  //
  if (
    highFee < MAX_FEE &&
    lowFee < MAX_FEE &&
    standardFeeHigh > 0 &&
    standardFeeLow < MAX_FEE
  ) {
    // Overwrite the fees with those from earn.com
    return {
      lowFee: lowFee.toFixed(0),
      standardFeeLow: standardFeeLow.toFixed(0),
      standardFeeHigh: standardFeeHigh.toFixed(0),
      highFee: highFee.toFixed(0)
    }
  } else {
    return {}
  }
}

type MempoolSpaceFees = ReturnType<typeof asMempoolSpaceFees>
export const asMempoolSpaceFees = asObject({
  fastestFee: asNumber,
  halfHourFee: asNumber,
  hourFee: asNumber
})

interface FetchFeesFromMempoolSpaceArgs extends Common {
  mempoolSpaceFeeInfoServer: string
}

/**
 * Fetches and calculates the FeeRates object from MempoolSpace
 * Sets the minimum of LOW_FEE on all fee levels
 * @param args
 * @returns Partial<FeeRates>
 */
const fetchFeesFromMempoolSpace = async (
  args: FetchFeesFromMempoolSpaceArgs
): Promise<Partial<FeeRates>> => {
  const response = await args.io.fetch(args.mempoolSpaceFeeInfoServer)
  if (!response.ok) throw new Error('Error fetching fees from MempoolSpace')

  const fees: MempoolSpaceFees = await response.json()
  try {
    asMempoolSpaceFees(fees)
  } catch (err) {
    args.log.error('Invalid fee structure from MempoolSpace')
    return {}
  }

  const standardFeeLow = fees.hourFee.toString()
  const lowFee = bs.div(standardFeeLow, '2')
  const standardFeeHigh = fees.halfHourFee.toString()
  const highFee = fees.fastestFee.toString()

  return {
    lowFee: bs.max(lowFee, LOW_FEE.toString()),
    standardFeeLow: bs.max(standardFeeLow, LOW_FEE.toString()),
    standardFeeHigh: bs.max(standardFeeHigh, LOW_FEE.toString()),
    highFee: bs.max(highFee, LOW_FEE.toString())
  }
}

/**
 * Calculate the sat/byte mining fee given an amount to spend and a SimpleFeeSettings object
 * @param nativeAmount
 * @param fees
 * @param networkFeeOption
 * @param customNetworkFee
 * @returns {string}
 */
export function calcMinerFeePerByte(
  nativeAmount: string,
  fees: SimpleFeeSettings,
  networkFeeOption?: NetworkFeeOption,
  customNetworkFee?: string
): string {
  switch (networkFeeOption) {
    case 'low':
      return fees.lowFee

    case 'standard': {
      if (bs.gte(nativeAmount, fees.standardFeeHighAmount)) {
        return fees.standardFeeHigh
      }
      if (bs.lte(nativeAmount, fees.standardFeeLowAmount)) {
        return fees.standardFeeLow
      }

      // Scale the fee by the amount the user is sending scaled between standardFeeLowAmount and standardFeeHighAmount
      const lowHighAmountDiff = bs.sub(
        fees.standardFeeHighAmount,
        fees.standardFeeLowAmount
      )
      const lowHighFeeDiff = bs.sub(fees.standardFeeHigh, fees.standardFeeLow)

      // How much above the lowFeeAmount is the user sending
      const amountDiffFromLow = bs.sub(nativeAmount, fees.standardFeeLowAmount)

      // Add this much to the low fee = (amountDiffFromLow * lowHighFeeDiff) / lowHighAmountDiff)
      const temp1 = bs.mul(amountDiffFromLow, lowHighFeeDiff)
      const addFeeToLow = bs.div(temp1, lowHighAmountDiff)
      return bs.add(fees.standardFeeLow, addFeeToLow)
    }

    case 'high':
      return fees.highFee

    case 'custom':
      if (customNetworkFee == null || customNetworkFee === '0') {
        throw new Error(`Invalid custom network fee: ${customNetworkFee}`)
      }
      return customNetworkFee

    default:
      throw new Error(`Invalid networkFeeOption: ${networkFeeOption}`)
  }
}
