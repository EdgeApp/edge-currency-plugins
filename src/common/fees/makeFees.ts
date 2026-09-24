import * as bs from 'biggystring'
import { asMaybe, Cleaner } from 'cleaners'
import {
  EdgeIo,
  EdgeLog,
  EdgeSpendInfo,
  EdgeSpendTarget
} from 'edge-core-js/types'

import { removeUndefined } from '../../util/filterUndefined'
import { INFO_SERVER_URI } from '../constants'
import { PluginStore } from '../plugin/pluginStore'
import { asFeeInfo, FeeInfo, PluginInfo } from '../plugin/types'
import { calcMinerFeePerByte } from './calcMinerFeePerByte'
import { processMempoolSpaceFees } from './processMempoolSpaceFees'

interface MakeFeesConfig extends Common {
  pluginStore: PluginStore
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
  const { pluginStore, pluginInfo, ...common } = config
  const { currencyInfo, engineInfo } = pluginInfo

  const feeInfo: FeeInfo = await pluginStore
    .loadFees(engineInfo.defaultFeeInfo)
    .catch(error => {
      common.log.warn(`Failed to load cached fees: ${String(error)}`)
      return engineInfo.defaultFeeInfo
    })
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

    await pluginStore.saveFees(feeInfo)
  }

  return {
    async start(): Promise<void> {
      const edgeFees = await fetchFees({
        ...common,
        uri: `${INFO_SERVER_URI}/v1/networkFees/${currencyInfo.pluginId}`,
        cleaner: asMaybe(asFeeInfo(feeInfo), null)
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
      await pluginStore.clearFees()
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
