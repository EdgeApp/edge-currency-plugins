export interface CoinPrefixes {
  messagePrefix: string
  wif: number
  legacyXPriv: number
  legacyXPub: number
  wrappedSegwitXPriv?: number
  wrappedSegwitXPub?: number
  segwitXPriv?: number
  segwitXPub?: number
  pubkeyHash: number
  scriptHash: number
  bech32?: string
  cashAddr?: string
}

export interface Coin {
  name: string
  segwit: boolean
  mainnetConstants: CoinPrefixes
  testnetConstants: CoinPrefixes
}
