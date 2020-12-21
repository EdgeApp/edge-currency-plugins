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
  cashaddr?: string
}

export interface Coin {
  name: string
  segwit: boolean
  coinType: number
  sighash?: number
  sighashFunction?: (Hash: Buffer) => Buffer
  bs58DecodeFunc?: (payload: string | undefined) => Buffer
  bs58EncodeFunc?: (payload: any) => string
  wifEncodeFunc?: (prefix: any, key: any, compressed: any) => string
  mainnetConstants: CoinPrefixes
  // by default should contain the bitcoin mainnet constants, useful for networks were multiple constants were in use.
  legacyConstants?: CoinPrefixes
  testnetConstants: CoinPrefixes
}
