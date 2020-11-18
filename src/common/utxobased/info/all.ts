import { EdgeCurrencyInfo } from 'edge-core-js'

import { info as bitcoin } from './bitcoin'
import { EngineCurrencyInfo } from '../../plugin/types'

export const allInfo: Array<EngineCurrencyInfo & EdgeCurrencyInfo> = [bitcoin]
