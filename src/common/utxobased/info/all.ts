import { EdgeCurrencyInfo } from 'edge-core-js'

import { EngineCurrencyInfo } from '../../plugin/CurrencyEngine'
import { info as bitcoin } from './bitcoin'

export const allInfo: Array<EngineCurrencyInfo & EdgeCurrencyInfo> = [bitcoin]
