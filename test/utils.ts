import { Disklet, makeMemoryDisklet } from 'disklet'
import {
  EdgeFetchFunction,
  EdgeFetchHeaders,
  EdgeFetchOptions,
  EdgeIo,
  EdgeLog
} from 'edge-core-js/types'

import { PluginInfo } from '../src/common/plugin/types'

export const makeFakePluginInfo = (): PluginInfo => {
  return {
    currencyInfo: {
      addressExplorer: '',
      currencyCode: '',
      defaultSettings: {},
      denominations: [],
      displayName: '',
      metaTokens: [],
      pluginId: '',
      transactionExplorer: '',
      walletType: ''
    },
    engineInfo: {
      coinType: 0,
      customFeeSettings: [],
      defaultFee: 0,
      feeUpdateInterval: 0,
      gapLimit: 0,
      network: '',
      simpleFeeSettings: {
        highFee: '1',
        lowFee: '2',
        standardFeeHigh: '3',
        standardFeeHighAmount: '4',
        standardFeeLow: '5',
        standardFeeLowAmount: '6'
      }
    },
    coinInfo: {
      name: 'bitcoin',
      segwit: true,
      coinType: 0,

      mainnetConstants: {
        messagePrefix: '\x18Bitcoin Signed Message:\n',
        wif: 0x80,
        legacyXPriv: 0x0488ade4,
        legacyXPub: 0x0488b21e,
        wrappedSegwitXPriv: 0x049d7878,
        wrappedSegwitXPub: 0x049d7cb2,
        segwitXPriv: 0x04b2430c,
        segwitXPub: 0x04b24746,
        pubkeyHash: 0x00,
        scriptHash: 0x05,
        bech32: 'bc'
      },

      testnetConstants: {
        messagePrefix: '\x18Bitcoin Signed Message:\n',
        wif: 0xef,
        legacyXPriv: 0x04358394,
        legacyXPub: 0x043587cf,
        wrappedSegwitXPriv: 0x044a4e28,
        wrappedSegwitXPub: 0x044a5262,
        segwitXPriv: 0x045f18bc,
        segwitXPub: 0x045f1cf6,
        pubkeyHash: 0x6f,
        scriptHash: 0xc4,
        bech32: 'tb'
      }
    }
  }
}

export const makeFakeLog = (): EdgeLog => {
  const fakeLog = (): void => {
    return
  }
  fakeLog.breadcrumb = () => {
    return
  }
  fakeLog.crash = () => {
    return
  }
  fakeLog.warn = () => {
    return
  }
  fakeLog.error = () => {
    return
  }
  return fakeLog
}

interface FakeIoConfig {
  disklet?: Disklet
}
export const makeFakeIo = (config?: FakeIoConfig): EdgeIo => {
  return {
    // @ts-expect-error - assigned to null
    console: null,
    disklet: config?.disklet ?? makeMemoryDisklet(),
    fetch: makeFakeFetch(),
    random(bytes: number): Uint8Array {
      return new Uint8Array([...Array(bytes).keys()])
    },
    async scrypt(
      _data: Uint8Array,
      _salt: Uint8Array,
      _n: number,
      _r: number,
      _p: number,
      _dklen: number
    ): Promise<Uint8Array> {
      return new Uint8Array()
    }
  }
}

const makeFakeFetch = (): EdgeFetchFunction => async (
  _uri: string,
  _opts?: EdgeFetchOptions
) => {
  return {
    async arrayBuffer(): Promise<ArrayBuffer> {
      return new ArrayBuffer(0)
    },
    headers: {
      forEach: (
        _callback: (
          value: string,
          name: string,
          self: EdgeFetchHeaders
        ) => void,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _thisArg?: any
      ): undefined => {
        return undefined
      },
      get: (_name: string): string | null => {
        return null
      },
      has: (_name: string): boolean => {
        return false
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async json(): Promise<any> {
      return {}
    },
    ok: true,
    status: 200,
    async text(): Promise<string> {
      return await Promise.resolve('')
    }
  }
}
