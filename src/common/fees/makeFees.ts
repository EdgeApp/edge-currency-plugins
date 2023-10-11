import * as bs from 'biggystring'
import { asMaybe, Cleaner } from 'cleaners'
import { Disklet } from 'disklet'
import {
  EdgeIo,
  EdgeLog,
  EdgeSpendInfo,
  EdgeSpendTarget
} from 'edge-core-js/types'
import { makeMemlet, Memlet } from 'memlet'

import { removeUndefined } from '../../util/filterUndefined'
import { FEES_PATH, INFO_SERVER_URI } from '../constants'
import { asFeeInfo, FeeInfo, PluginInfo } from '../plugin/types'
import { calcMinerFeePerByte } from './calcMinerFeePerByte'
import { processMempoolSpaceFees } from './processMempoolSpaceFees'

interface MakeFeesConfig extends Common {
  disklet: Disklet
  pluginInfo: PluginInfo
}

interface Common {
  io: EdgeIo
  log: EdgeLog
}

export interface Fees {
  start: () => Promise<void>
  stop: () => void
  clearCache: () => Promise<void>
  getRate: (edgeSpendInfo: EdgeSpendInfo) => Promise<string>
  feeInfo: FeeInfo
}

export const makeFees = async (config: MakeFeesConfig): Promise<Fees> => {
  const { disklet, pluginInfo, ...common } = config
  const { currencyInfo, engineInfo } = pluginInfo

  const memlet = makeMemlet(disklet)
  const feeInfo: FeeInfo = await fetchCachedFees(
    memlet,
    engineInfo.defaultFeeInfo
  )
  // The last time the fees were updated
  let timestamp = 0
  let vendorIntervalId: NodeJS.Timeout

  const updateVendorFees = async (): Promise<void> => {
    if (Date.now() - timestamp <= engineInfo.feeUpdateInterval) return

    const vendorFees = await fetchFeesFromVendor({
      ...common,
      mempoolSpaceFeeInfoServer: engineInfo.mempoolSpaceFeeInfoServer
    })
    const cleanedVendorFees = removeUndefined(vendorFees ?? {})
    Object.assign(feeInfo, cleanedVendorFees)
    timestamp = Date.now()

    await cacheFees(memlet, feeInfo)
  }

  return {
    async start(): Promise<void> {
      const edgeFees = await fetchFees({
        ...common,
        uri: `${INFO_SERVER_URI}/v1/networkFees/${currencyInfo.pluginId}`,
        cleaner: asMaybe(asFeeInfo, null)
      })
      Object.assign(feeInfo, edgeFees)
      await updateVendorFees()
      vendorIntervalId = setInterval(
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        updateVendorFees,
        engineInfo.feeUpdateInterval
      )
    },

    stop(): void {
      clearInterval(vendorIntervalId)
    },

    async clearCache(): Promise<void> {
      await memlet.delete(FEES_PATH)
    },

    async getRate(edgeSpendInfo: EdgeSpendInfo): Promise<string> {
      const {
        spendTargets,
        networkFeeOption = 'standard',
        customNetworkFee = {},
        otherParams = {}
      } = edgeSpendInfo

      const requiredFeeRate =
        otherParams.paymentProtocolInfo?.merchant?.requiredFeeRate
      if (requiredFeeRate != null) {
        const rate = bs.add(bs.mul(`${requiredFeeRate}`, '1.5'), '1')
        return bs.toFixed(rate, 0, 0)
      }

      const customFeeTemplate = (currencyInfo.customFeeTemplate ?? [])[0]
      if (customFeeTemplate == null) throw new Error('No custom fee template')

      const rate = calcMinerFeePerByte(
        sumSpendTargets(spendTargets),
        feeInfo,
        networkFeeOption,
        customNetworkFee[customFeeTemplate.key]
      )
      return rate
    },

    get feeInfo(): FeeInfo {
      return feeInfo
    }
  }
}

const fetchCachedFees = async (
  memlet: Memlet,
  fallback: FeeInfo
): Promise<FeeInfo> => {
  const data = await memlet.getJson(FEES_PATH).catch(() => undefined)
  const feeSettings = asMaybe(asFeeInfo, fallback)(data)
  return feeSettings
}

const cacheFees = async (memlet: Memlet, feeInfo: FeeInfo): Promise<void> =>
  await memlet.setJson(FEES_PATH, feeInfo)

const sumSpendTargets = (spendTargets: EdgeSpendTarget[]): string =>
  spendTargets.reduce((amount, { nativeAmount }) => {
    if (nativeAmount == null)
      throw new Error(`Invalid spend target amount: ${nativeAmount}`)
    return bs.add(amount, nativeAmount)
  }, '0')

interface FetchFeesArgs<T> extends Common {
  uri: string
  cleaner: Cleaner<T>
}
const fetchFees = async <T>(args: FetchFeesArgs<T>): Promise<T | null> => {
  const { uri, cleaner, io, log } = args

  try {
    const response = await io.fetch(uri)
    if (!response.ok) throw new Error(`Error fetching fees from ${uri}`)

    const fees = await response.json()
    return cleaner(fees)
  } catch (err) {
    log(err.message)
    return null
  }
}

interface FetchFeesFromVendorArgs extends Common {
  mempoolSpaceFeeInfoServer?: string
}

const fetchFeesFromVendor = async (
  args: FetchFeesFromVendorArgs
): Promise<Partial<FeeInfo>> => {
  if (args.mempoolSpaceFeeInfoServer != null) {
    const mempoolFees = await fetchFees({
      ...args,
      uri: args.mempoolSpaceFeeInfoServer,
      cleaner: processMempoolSpaceFees
    })
    if (mempoolFees != null) {
      return mempoolFees
    }
  }

  return {}
}
