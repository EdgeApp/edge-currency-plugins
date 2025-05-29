import {
  crypto,
  initEccLib,
  networks,
  opcodes,
  payments,
  Psbt,
  script as bitcoinScript,
  Transaction
} from 'altcoin-js'
import { gt, lt } from 'biggystring'
import * as bip32 from 'bip32'
import * as bip39 from 'bip39'
import bitcoinMessage from 'bitcoinjs-message'
import { asValue } from 'cleaners'
import { ECPairAPI, ECPairFactory } from 'ecpair'
import { EdgeLog, EdgeMemo } from 'edge-core-js/types'

import { indexAtProtected } from '../../../util/indexAtProtected'
import { undefinedIfEmptyString } from '../../../util/undefinedIfEmptyString'
import { ChangePath, CoinInfo, CoinPrefixes, FeeInfo } from '../../plugin/types'
import { UtxoData } from '../db/types'
import { ScriptTemplate, ScriptTemplates } from '../info/scriptTemplates/types'
import { sortInputs, sortOutputs } from './bip69'
import {
  cashAddressToHash,
  CashaddrTypeEnum,
  hashToCashAddress
} from './bitcoincashUtils/cashAddress'
import { getCoinFromString } from './coinmapper'
import { InsufficientFundsErrorPlus } from './types'
import * as utxopicker from './utxopicker'
import * as pickerUtils from './utxopicker/utils'

let ECPairCache: ECPairAPI
const getECPair = (): ECPairAPI => {
  if (ECPairCache != null) return ECPairCache

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const secp256k1 = require('@bitcoinerlab/secp256k1')
  initEccLib(secp256k1)
  ECPairCache = ECPairFactory(secp256k1)
  console.log(`loaded ECPair!`)

  return ECPairCache
}

// in bitcoin these are bip44, bip49, bip84 xpub prefixes
// other coins contain different formats which still need to be gathered.
export enum BIP43PurposeTypeEnum {
  Airbitz = 'airbitz',
  Legacy = 'legacy', // xpub/xprv tpub/tprv etc.
  Segwit = 'segwit', // zpub/zprv vpub/vprv etc.
  WrappedSegwit = 'wrappedSegwit', // ypub/yprv upub/uprv etc.
  ReplayProtection = 'replayProtection'
}

// supported address types.
export enum AddressTypeEnum {
  p2pkh = 'p2pkh',
  p2sh = 'p2sh',
  p2wpkh = 'p2wpkh', // short bech32 address
  p2wsh = 'p2wsh', // long bech32 address
  p2tr = 'p2tr' // bech32m address
}

export enum ScriptTypeEnum {
  p2wpkh = 'p2wpkh',
  p2wpkhp2sh = 'p2wpkhp2sh',
  p2wsh = 'p2wsh',
  p2pk = 'p2pk',
  p2pkh = 'p2pkh',
  p2sh = 'p2sh',
  p2tr = 'p2tr',
  replayProtection = 'replayprotection',
  replayProtectionP2SH = 'replayprotectionp2sh'
}
export const asScriptTypeEnum = asValue(
  'p2wpkh' as ScriptTypeEnum.p2wpkh,
  'p2wpkhp2sh' as ScriptTypeEnum.p2wpkhp2sh,
  'p2wsh' as ScriptTypeEnum.p2wsh,
  'p2pk' as ScriptTypeEnum.p2pk,
  'p2pkh' as ScriptTypeEnum.p2pkh,
  'p2sh' as ScriptTypeEnum.p2sh,
  'p2tr' as ScriptTypeEnum.p2tr,
  'replayprotection' as ScriptTypeEnum.replayProtection,
  'replayprotectionp2sh' as ScriptTypeEnum.replayProtectionP2SH
)

// A transaction input is either legacy or segwit. This is used for transaction creation and passed per input
export enum TransactionInputTypeEnum {
  Legacy = 'legacy',
  Segwit = 'segwit'
}

export interface VerifyAddressArgs {
  address: string
  coin: string
}

export enum VerifyAddressEnum {
  good = 'good',
  legacy = 'legacy',
  bad = 'bad'
}

export interface SeedOrMnemonicToXPrivArgs {
  seed: string
  type: BIP43PurposeTypeEnum
  coinType?: number // defaults to the coin type as defined in the coin class
  account?: number // defaults to account 0'
  coin: string
}

export interface XPrivToXPubArgs {
  xpriv: string
  type: BIP43PurposeTypeEnum
  coin: string
}

export interface XPrivToPrivateKeyArgs {
  xpriv: string
  type: BIP43PurposeTypeEnum
  bip44ChangeIndex: number
  bip44AddressIndex: number
  coin: string
}

export interface XPubToPubkeyArgs {
  xpub: string
  type: BIP43PurposeTypeEnum
  bip44ChangeIndex: number
  bip44AddressIndex: number
  coin: string
}

export interface AddressToScriptPubkeyArgs {
  address: string
  addressType?: AddressTypeEnum
  coin: string
}

export interface PubkeyToScriptPubkeyArgs {
  pubkey: string
  scriptTemplates?: ScriptTemplates
  scriptType: ScriptTypeEnum
}

export interface PubkeyToScriptPubkeyReturn {
  scriptPubkey: string
  redeemScript?: string
}

export interface ScriptPubkeyToAddressArgs {
  scriptPubkey: string
  addressType: AddressTypeEnum
  coin: string
  redeemScript?: string
  includeCashaddrPrefix?: boolean
}

export interface ScriptPubkeyToAddressReturn {
  address: string
  legacyAddress: string
}

// Careful! Calling this the ScriptHash is only correct for p2sh addresses.
// For p2pkh and p2wpkh this is just the pubkey hash.
// To get the script hash as used by electrum servers, follow their docs here:
// https://electrumx.readthedocs.io/en/latest/protocol-basics.html#script-hashes
// and use to scriptPubkeyToElectrumScriptHash function
export interface ScriptPubkeyToScriptHashArgs {
  scriptPubkey: string
  scriptType: ScriptTypeEnum
  coin: string
}

export interface ScriptPubkeyToP2SHArgs {
  scriptPubkey: string
  coin?: string
}

export interface ScriptPubkeyToP2SHReturn {
  scriptPubkey: string
  redeemScript: string
  address?: string
}

interface ScriptHashToScriptPubkeyArgs {
  scriptHash: string
  scriptType: ScriptTypeEnum
  coin: string
}

export interface WIFToPrivateKeyEncodingArgs {
  wifKey: string
  coin: string
}

export interface PrivateKeyEncoding {
  hex: string
  compressed: boolean
}

export interface PrivateKeyToWIFArgs {
  privateKey: string
  coin: string
}

export interface TxInput {
  type: TransactionInputTypeEnum
  prevTxid: string
  index: number
  prevTx?: string // required for legacy transactions
  prevScriptPubkey?: string // required for segwit transactions
  redeemScript?: string // required for p2sh transaction such as wrapped segwit
  value?: number // required for segwit transactions
}

export interface TxOutput {
  scriptPubkey: string
  amount: number
}

export interface MakeTxArgs {
  forceUseUtxo: UtxoData[]
  utxos: UtxoData[]
  targets: MakeTxTarget[]
  memos: EdgeMemo[]
  feeRate: number
  enableRbf: boolean
  coin: string
  currencyCode: string
  freshChangeAddress: string
  subtractFee?: boolean
  log?: EdgeLog
  outputSort: 'bip69' | 'targets'
}

export interface MakeTxTarget {
  address?: string
  scriptPubkey?: string
  value?: number
}

export interface MakeTxReturn extends Required<utxopicker.UtxoPickerResult> {
  hex: string
  psbtBase64: string
}

export interface SignTxArgs {
  coin: string
  feeInfo: FeeInfo
  psbtBase64: string
  privateKeyEncodings: PrivateKeyEncoding[]
}

interface SignTxReturn {
  id: string
  hex: string
}

type BitcoinJSNetwork = networks.Network

export interface Bip32 {
  public: number
  private: number
}

interface Bip32NetworkFromCoinArgs {
  coinString: string
  prefixIndex: number
  sigType?: BIP43PurposeTypeEnum
  forWIF?: boolean
}

export function bip43PurposeNumberToTypeEnum(
  num: number
): BIP43PurposeTypeEnum {
  switch (num) {
    case 32:
      return BIP43PurposeTypeEnum.Airbitz
    case 44:
      return BIP43PurposeTypeEnum.Legacy
    case 49:
      return BIP43PurposeTypeEnum.WrappedSegwit
    case 84:
      return BIP43PurposeTypeEnum.Segwit
    default:
      throw new Error('InvalidPurposeNumber')
  }
}

export interface SelectedCoinPrefixes {
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

const verifyAddressInternal = (
  prefixIndex: number,
  args: VerifyAddressArgs
): VerifyAddressEnum => {
  const coinInfo: CoinInfo = getCoinFromString(args.coin)
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    prefixIndex
  })

  // Special case for CashAddr
  const cashAddrPrefixes = getCashAddrPrefixes(coinInfo)
  if (cashAddrPrefixes.length > 0) {
    // If coin has cashaddr prefixes, and address passes cashaddr validation,
    // then we return as "valid", otherwise we return as "legacy" if it passes
    // the normal guess check.
    try {
      cashAddressToHash(args.address, cashAddrPrefixes)
      return VerifyAddressEnum.good
    } catch (e) {}
    guessAddressTypeFromAddress(args.address, network, args.coin, undefined)
    return VerifyAddressEnum.legacy
  }

  // Normal case
  guessAddressTypeFromAddress(args.address, network, args.coin, undefined)
  // All indices above 0 are treated as legacy
  return prefixIndex === 0 ? VerifyAddressEnum.good : VerifyAddressEnum.legacy
}

export const verifyAddress = (args: VerifyAddressArgs): VerifyAddressEnum => {
  const verification = filterCoinPrefixes(
    args.coin,
    prefixIndex => verifyAddressInternal(prefixIndex, args),
    [`Could not determine address type of ${args.address}`]
  )
  return verification ?? VerifyAddressEnum.bad
}

export const getAddressTypeFromAddress = (
  address: string,
  coinName: string
): AddressTypeEnum => {
  const addressType = filterCoinPrefixes(
    coinName,
    prefixIndex => {
      const network = bip32NetworkFromCoin({
        coinString: coinName,
        prefixIndex
      })
      return guessAddressTypeFromAddress(address, network, coinName)
    },
    [`Could not determine address type of ${address}`]
  )
  if (addressType == null) throw new Error('Could not determine address type')
  return addressType
}

export function seedOrMnemonicToXPriv(args: SeedOrMnemonicToXPrivArgs): string {
  // match hexadecimal number from beginning to end of string
  const isMnemonic = args.seed.includes(' ')
  const seed = isMnemonic
    ? bip39.mnemonicToSeedSync(args.seed)
    : Buffer.from(args.seed, 'base64')
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    sigType: args.type,
    prefixIndex: 0
  })
  const coin = getCoinFromString(args.coin)
  const purpose = bip43PurposeTypeEnumToNumber(args.type)
  const coinType = args.coinType ?? coin.coinType
  const account = args.account ?? 0
  const bip32FromSeedFunc = coin.bip32FromSeedFunc ?? bip32.fromSeed
  const root: bip32.BIP32Interface = bip32FromSeedFunc(seed)
  root.network = network
  // treat a detected seed as an airbitz seed
  return purpose === 32 || !isMnemonic
    ? root.derive(0).toBase58()
    : root
        .deriveHardened(purpose)
        .deriveHardened(coinType)
        .deriveHardened(account)
        .toBase58()
}
const xprivToXPubInternal = (
  prefixIndex: number,
  args: XPrivToXPubArgs
): string => {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    sigType: args.type,
    prefixIndex
  })
  const coin = getCoinFromString(args.coin)
  const bip32FromBase58Func = coin.bip32FromBase58Func ?? bip32.fromBase58
  return bip32FromBase58Func(args.xpriv, network).neutered().toBase58()
}

export const xprivToXPub = (args: XPrivToXPubArgs): string => {
  const xpub = filterCoinPrefixes(
    args.coin,
    prefixIndex => xprivToXPubInternal(prefixIndex, args),
    ['Invalid private key']
  )
  if (xpub == null) {
    throw Error('unable to convert xpriv to xpub')
  }
  return xpub
}

export function derivationLevelScriptHash(
  scriptTemplate: ScriptTemplate
): number {
  // currently returns the derivation for an empty script template for a bitcoin cash
  // replay protection script (without key material)
  let hash = '0000'
  hash = crypto
    .hash160(Buffer.from(scriptTemplate(''), 'hex'))
    .slice(0, 4)
    .toString('hex')
  return parseInt(hash, 16)
}

export const isPathUsingDerivationLevelScriptHash = (
  scriptTemplate: ScriptTemplate,
  path: ChangePath
): boolean => {
  return path.changeIndex === derivationLevelScriptHash(scriptTemplate)
}

const xpubToPubkeyInternal = (
  prefixIndex: number,
  args: XPubToPubkeyArgs
): string => {
  const coin = getCoinFromString(args.coin)
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    sigType: args.type,
    prefixIndex
  })
  const bip32FromBase58Func = coin.bip32FromBase58Func ?? bip32.fromBase58
  const node: bip32.BIP32Interface = bip32FromBase58Func(args.xpub, network)
  return node
    .derive(args.bip44ChangeIndex)
    .derive(args.bip44AddressIndex)
    .publicKey.toString('hex')
}

export const xpubToPubkey = (args: XPubToPubkeyArgs): string => {
  const pubkey = filterCoinPrefixes(
    args.coin,
    prefixIndex => xpubToPubkeyInternal(prefixIndex, args),
    [`Invalid network version`]
  )
  if (pubkey == null) {
    throw Error('unable to derive pubkey from xpub')
  }
  return pubkey
}

const addressToScriptPubkeyInternal = (
  prefixIndex: number,
  args: AddressToScriptPubkeyArgs
): string => {
  const coin = getCoinFromString(args.coin)
  const cashAddrPrefixes = getCashAddrPrefixes(coin)
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    prefixIndex
  })
  const selectedPrefixes = selectedCoinPrefixes(coin.prefixes, prefixIndex)
  const addressType: AddressTypeEnum = guessAddressTypeFromAddress(
    args.address,
    network,
    args.coin,
    args.addressType
  )
  let payment: payments.PaymentCreator

  const maybeScriptHashFromCashAddress = (): string | undefined => {
    try {
      return cashAddressToHash(
        args.address,
        cashAddrPrefixes
      ).scriptHash.toString('hex')
    } catch (e) {}
  }

  switch (addressType) {
    case AddressTypeEnum.p2pkh:
      if (selectedPrefixes.cashaddr != null) {
        const scriptHash = maybeScriptHashFromCashAddress()
        if (scriptHash != null) {
          const scriptPubkey = scriptHashToScriptPubkey({
            scriptHash,
            scriptType: ScriptTypeEnum.p2pkh,
            coin: args.coin
          })
          if (scriptPubkey == null) {
            throw new Error(
              `unable to convert address ${args.address} to script pubkey`
            )
          }
          return scriptPubkey
        }
      }
      payment = payments.p2pkh
      break
    case AddressTypeEnum.p2sh:
      if (selectedPrefixes.cashaddr != null) {
        const scriptHash = maybeScriptHashFromCashAddress()
        if (scriptHash != null) {
          const scriptPubkey = scriptHashToScriptPubkey({
            scriptHash,
            scriptType: ScriptTypeEnum.p2sh,
            coin: args.coin
          })
          if (scriptPubkey == null) {
            throw new Error(
              `unable to convert address ${args.address} to script pubkey`
            )
          }
          return scriptPubkey
        }
      }
      payment = payments.p2sh
      break
    case AddressTypeEnum.p2wpkh:
      payment = payments.p2wpkh
      break
    case AddressTypeEnum.p2wsh:
      payment = payments.p2wsh
      break
    case AddressTypeEnum.p2tr:
      payment = payments.p2tr
      break
    default:
      throw new Error('invalid address type in address to script pubkey')
  }
  let scriptPubkey: Buffer | undefined
  try {
    scriptPubkey = payment({
      address: args.address,
      network,
      bs58DecodeFunc: coin.bs58DecodeFunc,
      bs58EncodeFunc: coin.bs58EncodeFunc
    }).output
  } catch (error) {
    console.trace(error)
    throw error
  }
  if (scriptPubkey == null) {
    throw new Error('failed converting address to scriptPubkey')
  }
  return scriptPubkey.toString('hex')
}

export const addressToScriptPubkey = (
  args: AddressToScriptPubkeyArgs
): string => {
  const scriptPubkey = filterCoinPrefixes(
    args.coin,
    prefixIndex => addressToScriptPubkeyInternal(prefixIndex, args),
    [
      'Invalid version or Network mismatch',
      'Invalid prefix or Network mismatch',
      `InvalidArgument: ${args.address} has Mixed case`,
      `Could not determine address type of ${args.address}`
    ]
  )
  if (scriptPubkey == null) {
    throw new Error(
      `unable to convert address ${args.address} to script pubkey`
    )
  }
  return scriptPubkey
}

export function scriptPubkeyToAddress(
  args: ScriptPubkeyToAddressArgs
): ScriptPubkeyToAddressReturn {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    prefixIndex: 0 // standard serialization at index 0
  })
  const legacyNetwork: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    prefixIndex: 1 // legacy serialziation at index 1
  })
  const coinClass = getCoinFromString(args.coin)
  const coinPrefixes = coinClass.prefixes
  const standardPrefixes = selectedCoinPrefixes(coinPrefixes, 0)
  const legacyPrefixes = selectedCoinPrefixes(coinPrefixes, 1)
  let address: string | undefined
  let legacyAddress: string | undefined
  let payment: payments.PaymentCreator
  switch (args.addressType) {
    case AddressTypeEnum.p2pkh:
      if (standardPrefixes.cashaddr != null) {
        address = hashToCashAddress(
          scriptPubkeyToScriptHash({
            scriptPubkey: args.scriptPubkey,
            scriptType: ScriptTypeEnum.p2pkh,
            coin: args.coin
          }),
          CashaddrTypeEnum.pubkeyhash,
          standardPrefixes.cashaddr,
          args.includeCashaddrPrefix
        )
      }
      if (legacyPrefixes.cashaddr != null) {
        legacyAddress = hashToCashAddress(
          scriptPubkeyToScriptHash({
            scriptPubkey: args.scriptPubkey,
            scriptType: ScriptTypeEnum.p2pkh,
            coin: args.coin
          }),
          CashaddrTypeEnum.pubkeyhash,
          legacyPrefixes.cashaddr,
          args.includeCashaddrPrefix
        )
      }
      payment = payments.p2pkh
      break
    case AddressTypeEnum.p2sh:
      if (standardPrefixes.cashaddr != null) {
        address = hashToCashAddress(
          scriptPubkeyToScriptHash({
            scriptPubkey: args.scriptPubkey,
            scriptType: ScriptTypeEnum.p2sh,
            coin: args.coin
          }),
          CashaddrTypeEnum.scripthash,
          standardPrefixes.cashaddr,
          args.includeCashaddrPrefix
        )
      }
      if (legacyPrefixes.cashaddr != null) {
        legacyAddress = hashToCashAddress(
          scriptPubkeyToScriptHash({
            scriptPubkey: args.scriptPubkey,
            scriptType: ScriptTypeEnum.p2sh,
            coin: args.coin
          }),
          CashaddrTypeEnum.scripthash,
          legacyPrefixes.cashaddr,
          args.includeCashaddrPrefix
        )
      }
      payment = payments.p2sh
      break
    case AddressTypeEnum.p2wpkh:
      payment = payments.p2wpkh
      break
    case AddressTypeEnum.p2wsh:
      payment = payments.p2wsh
      break
    case AddressTypeEnum.p2tr:
      payment = payments.p2tr
      break
    default:
      throw new Error('invalid address type in address to script pubkey')
  }
  try {
    address =
      address ??
      payment({
        output: Buffer.from(args.scriptPubkey, 'hex'),
        network,
        bs58DecodeFunc: coinClass.bs58DecodeFunc,
        bs58EncodeFunc: coinClass.bs58EncodeFunc
      }).address

    legacyAddress =
      legacyAddress ??
      payment({
        output: Buffer.from(args.scriptPubkey, 'hex'),
        network: legacyNetwork,
        bs58DecodeFunc: coinClass.bs58DecodeFunc,
        bs58EncodeFunc: coinClass.bs58EncodeFunc
      }).address
  } catch (error) {
    console.trace(error)
    throw error
  }

  if (address == null || legacyAddress == null) {
    throw new Error('failed converting scriptPubkey to address')
  }
  return { address, legacyAddress }
}

export function scriptPubkeyToScriptHash(
  args: ScriptPubkeyToScriptHashArgs
): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    prefixIndex: 0
  })
  let payment: payments.PaymentCreator
  switch (args.scriptType) {
    case ScriptTypeEnum.p2pkh:
      payment = payments.p2pkh
      break
    case ScriptTypeEnum.p2sh:
      payment = payments.p2sh
      break
    case ScriptTypeEnum.p2wpkh:
      payment = payments.p2wpkh
      break
    case ScriptTypeEnum.p2tr:
      payment = payments.p2tr
      break
    default:
      throw new Error('invalid address type in address to script pubkey')
  }
  let scriptHash: Buffer | undefined
  try {
    scriptHash = payment({
      output: Buffer.from(args.scriptPubkey, 'hex'),
      network
    }).hash
  } catch (error) {
    console.trace(error)
    throw error
  }
  if (scriptHash == null) {
    throw new Error('failed converting scriptPubkey to address')
  }
  return scriptHash.toString('hex')
}

export function scriptPubkeyToP2SH(
  args: ScriptPubkeyToP2SHArgs
): ScriptPubkeyToP2SHReturn {
  const { scriptPubkey, coin } = args
  let bip32Network
  if (coin != null) {
    bip32Network = bip32NetworkFromCoin({
      coinString: coin,
      prefixIndex: 0
    })
  }
  const p2sh = payments.p2sh({
    ...(bip32Network != null ? { network: bip32Network } : {}),
    redeem: {
      output: Buffer.from(scriptPubkey, 'hex')
    }
  })
  const scriptPubkeyFromLib = p2sh.output?.toString('hex')
  const redeemScript = p2sh.redeem?.output?.toString('hex')
  const scriptHash = p2sh.hash?.toString('hex')

  if (scriptPubkeyFromLib == null || redeemScript == null) {
    throw new Error('unable to convert script to p2sh')
  }

  let address: string | undefined = p2sh.address

  // Special cashaddr handling
  if (coin != null && scriptHash != null) {
    const coinClass = getCoinFromString(coin)
    const coinPrefixes = coinClass.prefixes
    const standardPrefixes = selectedCoinPrefixes(coinPrefixes, 0)
    if (standardPrefixes.cashaddr != null) {
      address = hashToCashAddress(
        scriptHash,
        CashaddrTypeEnum.scripthash,
        standardPrefixes.cashaddr
      )
    }
  }

  return {
    scriptPubkey: scriptPubkeyFromLib,
    redeemScript: redeemScript,
    address
  }
}

export function pubkeyToScriptPubkey(
  args: PubkeyToScriptPubkeyArgs
): PubkeyToScriptPubkeyReturn {
  let payment: payments.Payment
  switch (args.scriptType) {
    case ScriptTypeEnum.p2pkh: {
      payment = payments.p2pkh({
        pubkey: Buffer.from(args.pubkey, 'hex')
      })
      if (payment.output == null) {
        throw new Error('failed converting pubkey to script pubkey')
      }
      return { scriptPubkey: payment.output.toString('hex') }
    }
    case ScriptTypeEnum.p2wpkhp2sh: {
      return scriptPubkeyToP2SH({
        scriptPubkey: pubkeyToScriptPubkey({
          pubkey: args.pubkey,
          scriptType: ScriptTypeEnum.p2wpkh
        }).scriptPubkey
      })
    }
    case ScriptTypeEnum.p2wpkh: {
      payment = payments.p2wpkh({
        pubkey: Buffer.from(args.pubkey, 'hex')
      })
      if (payment.output == null) {
        throw new Error('failed converting pubkey to script pubkey')
      }
      return { scriptPubkey: payment.output.toString('hex') }
    }
    case ScriptTypeEnum.p2tr: {
      payment = payments.p2tr({
        pubkey: Buffer.from(args.pubkey, 'hex')
      })
      if (payment.output == null) {
        throw new Error('failed converting pubkey to script pubkey')
      }
      return { scriptPubkey: payment.output.toString('hex') }
    }
    case ScriptTypeEnum.replayProtection: {
      if (args.scriptTemplates == null)
        throw new Error('Missing replayProtection script template')
      const redeemScript = args.scriptTemplates.replayProtection(args.pubkey)
      return scriptPubkeyToP2SH({
        scriptPubkey: redeemScript
      })
    }
    default:
      throw new Error('invalid address type in pubkey to script pubkey')
  }
}

export const toNewFormat = (address: string, coinName: string): string => {
  const addressType = getAddressTypeFromAddress(address, coinName)
  return scriptPubkeyToAddress({
    scriptPubkey: addressToScriptPubkey({
      address: address,
      coin: coinName
    }),
    addressType,
    coin: coinName
  }).address
}

const xprivToPrivateKeyInternal = (
  prefixIndex: number,
  args: XPrivToPrivateKeyArgs
): string | undefined => {
  const coin = getCoinFromString(args.coin)
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    sigType: args.type,
    prefixIndex
  })
  const bip32FromBase58Func = coin.bip32FromBase58Func ?? bip32.fromBase58
  const node: bip32.BIP32Interface = bip32FromBase58Func(args.xpriv, network)
  return node
    .derive(args.bip44ChangeIndex)
    .derive(args.bip44AddressIndex)
    .privateKey?.toString('hex')
}

export const xprivToPrivateKey = (args: XPrivToPrivateKeyArgs): string => {
  const privateKey = filterCoinPrefixes(
    args.coin,
    prefixIndex => xprivToPrivateKeyInternal(prefixIndex, args),
    ['Invalid network version']
  )
  if (privateKey == null) {
    throw new Error('Failed to generate private key from xpriv')
  }
  return privateKey
}

export function privateKeyToWIF(args: PrivateKeyToWIFArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    forWIF: true,
    prefixIndex: 0
  })
  const coinClass = getCoinFromString(args.coin)
  const ECPair = getECPair()
  return ECPair.fromPrivateKey(Buffer.from(args.privateKey, 'hex'), {
    network
  }).toWIF(coinClass.wifEncodeFunc)
}

const wifToPrivateKeyEncodingInternal = (
  prefixIndex: number,
  args: WIFToPrivateKeyEncodingArgs
): PrivateKeyEncoding | undefined => {
  const coin = getCoinFromString(args.coin)
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    forWIF: true,
    prefixIndex
  })
  const ECPair = getECPair()
  const ecPair = ECPair.fromWIF(args.wifKey, network, coin.bs58DecodeFunc)
  if (ecPair.privateKey == null) return
  return {
    hex: ecPair.privateKey.toString('hex'),
    compressed: ecPair.compressed
  }
}
export const wifToPrivateKeyEncoding = (
  args: WIFToPrivateKeyEncodingArgs
): PrivateKeyEncoding => {
  const privateKeyEncoding = filterCoinPrefixes(
    args.coin,
    prefixIndex => wifToPrivateKeyEncodingInternal(prefixIndex, args),
    ['Invalid network version']
  )
  if (privateKeyEncoding == null) {
    throw new Error('Failed to convert WIF key to private key')
  }
  return privateKeyEncoding
}

export function privateKeyEncodingToPubkey(
  privateKeyEncoding: PrivateKeyEncoding
): string {
  const { hex, compressed } = privateKeyEncoding
  const ECPair = getECPair()
  return ECPair.fromPrivateKey(Buffer.from(hex, 'hex'), {
    compressed
  }).publicKey.toString('hex')
}

export function signMessageBase64(message: string, privateKey: string): string {
  const ECPair = getECPair()
  const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'))
  if (keyPair.privateKey == null) {
    throw new Error('Address could not sign message')
  }
  return bitcoinMessage
    .sign(message, keyPair.privateKey, keyPair.compressed)
    .toString('base64')
}

export function makeTx(args: MakeTxArgs): MakeTxReturn {
  const { log, outputSort, memos } = args
  let sequence = 0xffffffff
  if (args.enableRbf) {
    sequence -= 2
  }

  // get coin specific replay protection sighhash bits
  let sighashType = Transaction.SIGHASH_ALL
  const coin = getCoinFromString(args.coin)
  if (coin.sighash != null) {
    sighashType = coin.sighash
  }

  const useUtxos: utxopicker.UTXO[] = []
  const mappedUtxos: utxopicker.UTXO[] = []

  const mergedArray = [...args.utxos, ...args.forceUseUtxo]
  const uniqueUtxos = [
    ...mergedArray
      .filter(utxo => !utxo.spent)
      .reduce((map, obj) => map.set(obj.id, obj), new Map<string, UtxoData>())
      .values()
  ].sort((a, b) => {
    if (a.blockHeight <= 0 && b.blockHeight > 0) return 1
    if (b.blockHeight <= 0 && a.blockHeight > 0) return -1
    return lt(a.value, b.value) ? 1 : gt(a.value, b.value) ? -1 : 0
  })

  for (const utxo of uniqueUtxos) {
    // Cannot use a utxo without a script
    if (utxo.script == null) continue
    const input: utxopicker.UTXO = {
      hash: Buffer.from(utxo.txid, 'hex').reverse(),
      index: utxo.vout,
      value: parseInt(utxo.value),
      script: Buffer.from(utxo.script, 'hex'),
      scriptPubkey: Buffer.from(utxo.scriptPubkey, 'hex'),
      scriptType: utxo.scriptType,
      sequence,
      sighashType
    }
    // Map script type to the correct PsbtInput UTXO field
    switch (utxo.scriptType) {
      // Non-segwit
      case ScriptTypeEnum.p2pk:
      case ScriptTypeEnum.p2pkh:
      case ScriptTypeEnum.p2sh:
      case ScriptTypeEnum.replayProtection:
      case ScriptTypeEnum.replayProtectionP2SH: {
        input.nonWitnessUtxo = input.script
        break
      }
      // Segwit
      case ScriptTypeEnum.p2wpkh:
      case ScriptTypeEnum.p2wpkhp2sh:
      case ScriptTypeEnum.p2wsh: {
        input.witnessUtxo = {
          script: input.script,
          value: parseInt(utxo.value)
        }
        break
      }
      default:
        throw new Error(`unknown script type ${utxo.scriptType}`)
    }
    if (utxo.redeemScript != null) {
      input.redeemScript = Buffer.from(utxo.redeemScript, 'hex')
    }
    let forceUsage = false
    for (const forceUtxo of args.forceUseUtxo) {
      if (forceUtxo.id === utxo.id) {
        useUtxos.push(input)
        forceUsage = true
      }
    }
    if (!forceUsage) mappedUtxos.push(input)
  }

  const targets: utxopicker.Target[] = []
  for (const target of args.targets) {
    if (target.value == null) continue

    const scriptPubkey =
      target.address == null
        ? target.scriptPubkey
        : addressToScriptPubkey({
            address: target.address,
            coin: coin.name
          })

    if (scriptPubkey == null) continue

    targets.push({
      script: scriptPubkey,
      value: target.value
    })
  }
  for (const memo of memos) {
    const memoData =
      memo.type === 'text'
        ? Buffer.from(memo.value, 'utf8')
        : Buffer.from(memo.value, 'hex')
    const script = bitcoinScript
      .compile([opcodes.OP_RETURN, memoData])
      .toString('hex')
    targets.push({
      script,
      value: 0
    })
  }

  const changeScript = addressToScriptPubkey({
    address: args.freshChangeAddress,
    coin: coin.name
  })

  const utxoPicker = coin.utxoPicker ?? utxopicker.utxoPicker

  const utxopicking =
    args.forceUseUtxo.length > 0
      ? utxoPicker.forceUseUtxo
      : args.subtractFee ?? false
      ? utxoPicker.subtractFee
      : utxoPicker.accumulative
  const result = utxopicking({
    utxos: mappedUtxos,
    useUtxos,
    targets,
    feeRate: args.feeRate,
    changeScript
  })
  if (result.outputs == null) {
    const targetsValue = pickerUtils.sumOrNaN(targets)
    const inputsValue = pickerUtils.sumOrNaN(result.inputs)
    // This is how much fee is needed to validate the spend
    const feeDelta = result.fee - (inputsValue - targetsValue)
    throw new InsufficientFundsErrorPlus({
      tokenId: null,
      networkFee: result.fee.toString(),
      networkFeeShortage: feeDelta.toString()
    })
  }

  const sortedInputs = sortInputs(result.inputs)
  const sortedOutputs: utxopicker.Output[] = (() => {
    switch (outputSort) {
      case 'bip69':
        return sortOutputs(result.outputs)
      case 'targets':
        return result.outputs
    }
  })()

  const psbt = new Psbt()
  try {
    psbt.addInputs(sortedInputs)
    psbt.addOutputs(sortedOutputs)
  } catch (error) {
    log?.error(`Failed makeTx: ${String(error)}`)
    throw error
  }

  return {
    inputs: sortedInputs,
    outputs: sortedOutputs,
    changeUsed: result.changeUsed,
    fee: result.fee,
    psbtBase64: psbt.toBase64(),
    hex: psbt.data?.globalMap?.unsignedTx?.toBuffer()?.toString('hex')
  }
}

export async function signTx(args: SignTxArgs): Promise<SignTxReturn> {
  const { maximumFeeRate } = args.feeInfo
  const opts =
    maximumFeeRate != null ? { maximumFeeRate: parseInt(maximumFeeRate) } : {}
  const psbt = Psbt.fromBase64(args.psbtBase64, opts)
  const coin = getCoinFromString(args.coin)
  const ECPair = getECPair()

  const validator = (
    pubkey: Buffer,
    msghash: Buffer,
    signature: Buffer
  ): boolean => ECPair.fromPublicKey(pubkey).verify(msghash, signature)

  for (let i = 0; i < psbt.inputCount; i++) {
    const privateKeyEncoding =
      args.privateKeyEncodings[i] ??
      args.privateKeyEncodings[args.privateKeyEncodings.length - 1]
    const { hex, compressed } = privateKeyEncoding
    psbt.signInput(
      i,
      ECPair.fromPrivateKey(Buffer.from(hex, 'hex'), { compressed }),
      Psbt.DEFAULT_SIGHASHES,
      coin.sighashFunction
    )
    psbt.validateSignaturesOfInput(i, validator)
    psbt.finalizeInput(i)
  }
  const tx = psbt.extractTransaction()
  return {
    id: tx.getId(coin.txHashFunction),
    hex: tx.toHex()
  }
}

// ---------------------------------------------------------------------
// Internal Utilities
// ---------------------------------------------------------------------

const bip32NetworkFromCoin = (
  args: Bip32NetworkFromCoinArgs
): BitcoinJSNetwork => {
  const sigType = args.sigType ?? BIP43PurposeTypeEnum.Legacy
  const forWIF: boolean = args.forWIF ?? false
  const coin: CoinInfo = getCoinFromString(args.coinString)
  return bip32NetworkFromCoinPrefix(
    sigType,
    coin.prefixes,
    coin.segwit,
    forWIF,
    args.prefixIndex
  )
}

const bip32NetworkFromCoinPrefix = (
  sigType: BIP43PurposeTypeEnum,
  coinPrefixes: CoinPrefixes,
  _segwit: boolean,
  forWIF: boolean,
  prefixIndex: number
): BitcoinJSNetwork => {
  let xKeyPrefixes: Bip32
  const prefixes = selectedCoinPrefixes(coinPrefixes, prefixIndex)

  switch (sigType) {
    case BIP43PurposeTypeEnum.Segwit:
      if (prefixes.segwitXPub == null || prefixes.segwitXPriv == null) {
        throw new Error('segwit xpub prefix is undefined')
      }
      xKeyPrefixes = {
        public: prefixes.segwitXPub,
        private: prefixes.segwitXPriv
      }
      break
    case BIP43PurposeTypeEnum.WrappedSegwit:
      if (
        prefixes.wrappedSegwitXPub == null ||
        prefixes.wrappedSegwitXPriv == null
      ) {
        throw new Error('wrapped segwit xpub prefix is undefined')
      }
      xKeyPrefixes = {
        public: prefixes.wrappedSegwitXPub,
        private: prefixes.wrappedSegwitXPriv
      }
      break
    case BIP43PurposeTypeEnum.Legacy:
    case BIP43PurposeTypeEnum.Airbitz:
      xKeyPrefixes = {
        public: prefixes.legacyXPub,
        private: prefixes.legacyXPriv
      }
      break
    default:
      throw new Error('invalid bip43 purpose type')
  }

  const bech32: string = prefixes.bech32 ?? ''
  if (forWIF) {
    return {
      messagePrefix: prefixes.messagePrefix,
      wif: prefixes.wif,
      bip32: xKeyPrefixes,
      bech32: bech32,
      pubKeyHash: prefixes.pubkeyHash,
      scriptHash: prefixes.scriptHash
    }
  }
  return {
    messagePrefix: prefixes.messagePrefix,
    wif: 0x80,
    bip32: xKeyPrefixes,
    bech32: bech32,
    pubKeyHash: prefixes.pubkeyHash,
    scriptHash: prefixes.scriptHash
  }
}

const bip43PurposeTypeEnumToNumber = (
  purpose: BIP43PurposeTypeEnum
): number => {
  switch (purpose) {
    case BIP43PurposeTypeEnum.Airbitz:
      return 32
    case BIP43PurposeTypeEnum.Legacy:
      return 44
    case BIP43PurposeTypeEnum.WrappedSegwit:
      return 49
    case BIP43PurposeTypeEnum.Segwit:
      return 84
    case BIP43PurposeTypeEnum.ReplayProtection:
      return 44 // Only bip44 formatted wallets contain this purpose type (BCH)
  }
}

/**
 * Filters through a coin's prefixes calling a filter function for each coin
 * prefixIndex until the function returns a value.
 * If the function throws an error, the error is can be ignored if it's message
 * matches one of the given ignoredErrorMessages.
 */
const filterCoinPrefixes = <T>(
  coinName: string,
  filterer: (prefixIndex: number) => T,
  ignoredErrorMessages: string[] = []
): T | undefined => {
  const coinPrefixes = getCoinFromString(coinName).prefixes
  const maxLength = Object.values(coinPrefixes).reduce(
    (max, prefixes) => Math.max(prefixes.length, max),
    0
  )
  let out: T | undefined
  for (let prefixIndex = 0; prefixIndex < maxLength; prefixIndex++) {
    try {
      out = filterer(prefixIndex)
    } catch (e: any) {
      if (ignoredErrorMessages.includes(e.message)) {
        continue
      }
      throw e
    }
    if (out != null) break
  }
  return out
}

const getCashAddrPrefixes = (coinInfo: CoinInfo): string[] => {
  return coinInfo.prefixes.cashaddr ?? []
}

const guessAddressTypeFromAddress = (
  address: string,
  network: BitcoinJSNetwork,
  coin: string,
  addressType?: AddressTypeEnum
): AddressTypeEnum => {
  if (addressType != null) {
    return addressType
  }
  const coinClass: CoinInfo = getCoinFromString(coin)
  try {
    payments.p2pkh({
      address,
      network,
      bs58DecodeFunc: coinClass.bs58DecodeFunc,
      bs58EncodeFunc: coinClass.bs58EncodeFunc
    })
    return AddressTypeEnum.p2pkh
  } catch (_) {}
  try {
    payments.p2sh({
      address,
      network,
      bs58DecodeFunc: coinClass.bs58DecodeFunc,
      bs58EncodeFunc: coinClass.bs58EncodeFunc
    })
    return AddressTypeEnum.p2sh
  } catch (_) {}
  try {
    payments.p2wsh({ address, network })
    return AddressTypeEnum.p2wsh
  } catch (_) {}
  try {
    payments.p2wpkh({ address, network })
    return AddressTypeEnum.p2wpkh
  } catch (_) {}
  try {
    payments.p2tr({
      address,
      network
    })
    return AddressTypeEnum.p2tr
  } catch (_) {}
  const cashAddrPrefixes = getCashAddrPrefixes(coinClass)
  if (cashAddrPrefixes.length > 0) {
    try {
      const info = cashAddressToHash(address, cashAddrPrefixes)
      if (info.type === CashaddrTypeEnum.pubkeyhash) {
        return AddressTypeEnum.p2pkh
      }
      return AddressTypeEnum.p2sh
    } catch (e) {}
  }
  throw new Error(`Could not determine address type of ${address}`)
}

const selectedCoinPrefixes = (
  prefixes: CoinPrefixes,
  index: number
): SelectedCoinPrefixes => {
  return {
    messagePrefix: indexAtProtected(prefixes.messagePrefix, index),
    wif: indexAtProtected(prefixes.wif, index),
    legacyXPriv: indexAtProtected(prefixes.legacyXPriv, index),
    legacyXPub: indexAtProtected(prefixes.legacyXPub, index),
    wrappedSegwitXPriv: indexAtProtected(prefixes.wrappedSegwitXPriv, index),
    wrappedSegwitXPub: indexAtProtected(prefixes.wrappedSegwitXPub, index),
    segwitXPriv: indexAtProtected(prefixes.segwitXPriv, index),
    segwitXPub: indexAtProtected(prefixes.segwitXPub, index),
    pubkeyHash: indexAtProtected(prefixes.pubkeyHash, index),
    scriptHash: indexAtProtected(prefixes.scriptHash, index),
    bech32: indexAtProtected(prefixes.bech32, index),
    // Special handling for cashaddr to accommodate legacy addresses.
    // By allowing them to overflow we will fallback to p2pkh.
    cashaddr: undefinedIfEmptyString((prefixes.cashaddr ?? [])[index])
  }
}

const scriptHashToScriptPubkey = (
  args: ScriptHashToScriptPubkeyArgs
): string => {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    prefixIndex: 0
  })
  let payment: payments.PaymentCreator
  switch (args.scriptType) {
    case ScriptTypeEnum.p2pkh:
      payment = payments.p2pkh
      break
    case ScriptTypeEnum.p2sh:
      payment = payments.p2sh
      break
    case ScriptTypeEnum.p2wpkh:
      payment = payments.p2wpkh
      break
    case ScriptTypeEnum.p2tr:
      payment = payments.p2tr
      break
    default:
      throw new Error('invalid address type in address to script pubkey')
  }
  let scriptPubkey: Buffer | undefined
  try {
    scriptPubkey = payment({
      hash: Buffer.from(args.scriptHash, 'hex'),
      network: network
    }).output
  } catch (error) {
    console.trace(error)
    throw error
  }
  if (scriptPubkey == null) {
    throw new Error('failed converting scriptPubkey to address')
  }
  return scriptPubkey.toString('hex')
}
