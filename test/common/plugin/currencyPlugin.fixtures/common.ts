import {
  EdgeEncodeUri,
  EdgeParsedUri,
  EdgeWalletInfo
} from 'edge-core-js/types'

import { EncodeUriMetadata } from '../../../../src/common/plugin/types'

export interface FixtureType {
  pluginId: string
  WALLET_TYPE: string
  WALLET_FORMAT: string
  'Test Currency code': string
  key: number[]
  xpub: string
  'invalid key name': EdgeWalletInfo
  'invalid wallet type': EdgeWalletInfo
  parseUri: {
    [testName: string]: [string, EdgeParsedUri] | [string]
  }
  encodeUri: {
    [testName: string]:
      | [EdgeEncodeUri & EncodeUriMetadata, string]
      | [EdgeEncodeUri & EncodeUriMetadata]
  }
  getSplittableTypes?: {
    [walletFormat: string]: string[]
  }
}

export const key = [
  39,
  190,
  34,
  129,
  208,
  32,
  145,
  88,
  191,
  217,
  226,
  98,
  183,
  16,
  52,
  150,
  52,
  53,
  31,
  137,
  164,
  40,
  236,
  146,
  128,
  107,
  129,
  59,
  192,
  240,
  40,
  238
]
