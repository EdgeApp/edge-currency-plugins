/* eslint-disable camelcase */
import * as bitcoin from 'altcoin-js'
import * as bip32 from 'bip32'
import * as bip39 from 'bip39'

import { IUTXO } from '../db/types'
import {
  cashAddressToHash,
  CashaddrTypeEnum,
  hashToCashAddress,
} from './bitcoincashUtils/cashAddress'
import { cdsScriptTemplates } from './bitcoincashUtils/checkdatasig'
import { Coin, CoinPrefixes } from './coin'
import { getCoinFromString } from './coinmapper'
import * as utxopicker from './utxopicker'
import { NetworkEnum } from '../../plugin/types'

// in bitcoin these are bip44, bip49, bip84 xpub prefixes
// other coins contain different formats which still need to be gathered.
export enum BIP43PurposeTypeEnum {
  Airbitz = 'airbitz',
  Legacy = 'legacy', // xpub/xprv tpub/tprv etc.
  Segwit = 'segwit', // zpub/zprv vpub/vprv etc.
  WrappedSegwit = 'wrappedSegwit', // ypub/yprv upub/uprv etc.
}

// supported address types.
export enum AddressTypeEnum {
  p2pkh = 'p2pkh',
  p2sh = 'p2sh',
  p2wpkh = 'p2wpkh', // short bech32 address
  p2wsh = 'p2wsh', // long bech32 address
}

export enum ScriptTypeEnum {
  p2wpkh = 'p2wpkh',
  p2wpkhp2sh = 'p2wpkhp2sh',
  p2wsh = 'p2wsh',
  p2pk = 'p2pk',
  p2pkh = 'p2pkh',
  p2sh = 'p2sh',
  replayProtection = 'replayprotection',
  replayProtectionP2SH = 'replayprotectionp2sh',
}

// A transaction input is either legacy or segwit. This is used for transaction creation and passed per input
export enum TransactionInputTypeEnum {
  Legacy = 'legacy',
  Segwit = 'segwit',
}

export interface VerifyAddressArgs {
  address: string
  coin: string
  network: NetworkEnum
}

export enum VerifyAddressEnum {
  good = 'good',
  legacy = 'legacy',
  bad = 'bad',
}

export interface SeedOrMnemonicToXPrivArgs {
  seed: string
  network: NetworkEnum
  type: BIP43PurposeTypeEnum
  coinType?: number // defaults to the coin type as defined in the coin class
  account?: number // defaults to account 0'
  coin: string
}

export interface XPrivToXPubArgs {
  xpriv: string
  network: NetworkEnum
  type: BIP43PurposeTypeEnum
  coin: string
}

export interface XPrivToPrivateKeyArgs {
  xpriv: string
  network: NetworkEnum
  type: BIP43PurposeTypeEnum
  bip44ChangeIndex: number
  bip44AddressIndex: number
  coin: string
}

export interface XPubToPubkeyArgs {
  xpub: string
  network: NetworkEnum
  type: BIP43PurposeTypeEnum
  bip44ChangeIndex: number
  bip44AddressIndex: number
  coin: string
}

export interface AddressToScriptPubkeyArgs {
  address: string
  network: NetworkEnum
  addressType?: AddressTypeEnum
  legacy?: boolean
  coin: string
}

export interface PubkeyToScriptPubkeyArgs {
  pubkey: string
  scriptType: ScriptTypeEnum
}

export interface PubkeyToScriptPubkeyReturn {
  scriptPubkey: string
  redeemScript?: string
}

export interface ScriptPubkeyToAddressArgs {
  scriptPubkey: string
  addressType: AddressTypeEnum
  network: NetworkEnum
  coin: string
  redeemScript?: string
}

export interface ScriptPubkeyToAddressReturn {
  [x: string]: any
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
  network: NetworkEnum
  coin: string
}

export interface ScriptPubkeyToP2SHArgs {
  scriptPubkey: string
}

export interface ScriptPubkeyToP2SHReturn {
  scriptPubkey: string
  redeemScript: string
}

interface ScriptHashToScriptPubkeyArgs {
  scriptHash: string
  scriptType: ScriptTypeEnum
  network: NetworkEnum
  coin: string
}

export interface WIFToPrivateKeyArgs {
  wifKey: string
  network: NetworkEnum
  coin: string
}

export interface PrivateKeyToWIFArgs {
  privateKey: string
  network: NetworkEnum
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

export interface CreateTxArgs {
  network: NetworkEnum
  inputs: TxInput[]
  outputs: TxOutput[]
  rbf: boolean
  coin?: string
}

export interface CreateTxReturn {
  psbt: string
  vSize: number
}

export interface MakeTxArgs {
  network: NetworkEnum
  utxos: IUTXO[]
  targets: MakeTxTarget[]
  feeRate: number
  rbf: boolean
  coin: string
  freshChangeAddress: string
}

export interface MakeTxTarget {
  address: string
  value: number
}

interface MakeTxReturn {
  psbt: bitcoin.Psbt
  changeUsed: boolean
  fee: number
}

export interface SignTxArgs {
  privateKeys: string[]
  psbt: string
  coin: string
}

// BitcoinJSNetwork and Bip32 are the same interfaces as declared in  bitcoin-js ts_src/network.ts
// We redeclare them here for transparency reasons
export interface BitcoinJSNetwork {
  wif: number
  bip32: Bip32
  messagePrefix: string
  bech32: string
  pubKeyHash: number
  scriptHash: number
}

export interface Bip32 {
  public: number
  private: number
}

interface Bip32NetworkFromCoinArgs {
  networkType: NetworkEnum
  coinString: string
  sigType?: BIP43PurposeTypeEnum
  forWIF?: boolean
  legacy?: boolean
}

function bip43PurposeTypeEnumToNumber(purpose: BIP43PurposeTypeEnum): number {
  switch (purpose) {
    case BIP43PurposeTypeEnum.Airbitz:
      return 32
    case BIP43PurposeTypeEnum.Legacy:
      return 44
    case BIP43PurposeTypeEnum.WrappedSegwit:
      return 49
    case BIP43PurposeTypeEnum.Segwit:
      return 84
  }
}

export function bip43PurposeNumberToTypeEnum(num: number): BIP43PurposeTypeEnum {
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

function bip32NetworkFromCoinPrefix(
  sigType: BIP43PurposeTypeEnum,
  coinPrefixes: CoinPrefixes,
  segwit: Boolean,
  forWIF: Boolean
): BitcoinJSNetwork {
  let xKeyPrefixes: Bip32
  switch (sigType) {
    case BIP43PurposeTypeEnum.Segwit:
      if (
        typeof coinPrefixes.segwitXPub === 'undefined' ||
        typeof coinPrefixes.segwitXPriv === 'undefined'
      ) {
        throw new Error('segwit xpub prefix is undefined')
      }
      xKeyPrefixes = {
        public: coinPrefixes.segwitXPub,
        private: coinPrefixes.segwitXPriv,
      }
      break
    case BIP43PurposeTypeEnum.WrappedSegwit:
      if (
        typeof coinPrefixes.wrappedSegwitXPub === 'undefined' ||
        typeof coinPrefixes.wrappedSegwitXPriv === 'undefined'
      ) {
        throw new Error('wrapped segwit xpub prefix is undefined')
      }
      xKeyPrefixes = {
        public: coinPrefixes.wrappedSegwitXPub,
        private: coinPrefixes.wrappedSegwitXPriv,
      }
      break
    case BIP43PurposeTypeEnum.Legacy:
    case BIP43PurposeTypeEnum.Airbitz:
      xKeyPrefixes = {
        public: coinPrefixes.legacyXPub,
        private: coinPrefixes.legacyXPriv,
      }
      break
    default:
      throw new Error('invalid bip43 purpose type')
  }

  const bech32: string = coinPrefixes.bech32 ?? 'bc'
  if (forWIF === true) {
    return {
      messagePrefix: coinPrefixes.messagePrefix,
      wif: coinPrefixes.wif,
      bip32: xKeyPrefixes,
      bech32: bech32,
      pubKeyHash: coinPrefixes.pubkeyHash,
      scriptHash: coinPrefixes.scriptHash,
    }
  }
  return {
    messagePrefix: coinPrefixes.messagePrefix,
    wif: 0x80,
    bip32: xKeyPrefixes,
    bech32: bech32,
    pubKeyHash: coinPrefixes.pubkeyHash,
    scriptHash: coinPrefixes.scriptHash,
  }
}

function bip32NetworkFromCoin(
  args: Bip32NetworkFromCoinArgs
): BitcoinJSNetwork {
  const sigType = args.sigType ?? BIP43PurposeTypeEnum.Legacy
  const forWIF: boolean = args.forWIF ?? false
  const legacy: boolean = args.legacy ?? false
  const coin: Coin = getCoinFromString(args.coinString)
  if (args.networkType === NetworkEnum.Testnet) {
    return bip32NetworkFromCoinPrefix(
      sigType,
      coin.testnetConstants,
      coin.segwit,
      forWIF
    )
  }
  if (legacy && typeof coin.legacyConstants !== 'undefined') {
    return bip32NetworkFromCoinPrefix(
      sigType,
      coin.legacyConstants,
      coin.segwit,
      forWIF
    )
  }
  return bip32NetworkFromCoinPrefix(
    sigType,
    coin.mainnetConstants,
    coin.segwit,
    forWIF
  )
}

export function verifyAddress(args: VerifyAddressArgs): VerifyAddressEnum {
  try {
    const network: BitcoinJSNetwork = bip32NetworkFromCoin({
      networkType: args.network,
      coinString: args.coin,
    })
    guessAddressTypeFromAddress(args.address, network, args.coin, undefined)
    return VerifyAddressEnum.good
  } catch (e) {}
  try {
    const network: BitcoinJSNetwork = bip32NetworkFromCoin({
      networkType: args.network,
      coinString: args.coin,
      legacy: true,
    })
    guessAddressTypeFromAddress(args.address, network, args.coin, undefined)
    return VerifyAddressEnum.legacy
  } catch (e) {}
  return VerifyAddressEnum.bad
}

function guessAddressTypeFromAddress(
  address: string,
  network: BitcoinJSNetwork,
  coin: string,
  addressType: AddressTypeEnum | undefined
): AddressTypeEnum {
  if (typeof addressType !== 'undefined') {
    return addressType
  }
  const coinClass: Coin = getCoinFromString(coin)
  try {
    bitcoin.payments.p2pkh({
      address,
      network,
      bs58DecodeFunc: coinClass.bs58DecodeFunc,
      bs58EncodeFunc: coinClass.bs58EncodeFunc,
    })
    return AddressTypeEnum.p2pkh
  } catch (e) {}
  try {
    bitcoin.payments.p2sh({
      address,
      network,
      bs58DecodeFunc: coinClass.bs58DecodeFunc,
      bs58EncodeFunc: coinClass.bs58EncodeFunc,
    })
    return AddressTypeEnum.p2sh
  } catch (e) {}
  try {
    bitcoin.payments.p2wsh({ address, network })
    return AddressTypeEnum.p2wsh
  } catch (e) {}
  try {
    bitcoin.payments.p2wpkh({ address, network })
    return AddressTypeEnum.p2wpkh
  } catch (e) {}
  try {
    const info = cashAddressToHash(address)
    if (info.type === CashaddrTypeEnum.pubkeyhash) {
      return AddressTypeEnum.p2pkh
    }
    return AddressTypeEnum.p2sh
  } catch (e) {}

  throw new Error('Could not determine address type of ' + address)
}

export function seedOrMnemonicToXPriv(args: SeedOrMnemonicToXPrivArgs): string {
  // match hexadecimal number from beginning to end of string
  const isMnemonic = args.seed.includes(' ')
  const seed = isMnemonic
    ? bip39.mnemonicToSeedSync(args.seed)
    : Buffer.from(args.seed, 'base64')
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    networkType: args.network,
    coinString: args.coin,
    sigType: args.type,
  })
  const coin = getCoinFromString(args.coin)
  const purpose = bip43PurposeTypeEnumToNumber(args.type)
  let coinType = args.coinType ?? coin.coinType
  const account = args.account ?? 0
  coinType = args.network === 'testnet' ? 1 : coinType
  const bip32FromSeedFunc = coin.bip32FromSeedFunc ?? bip32.fromSeed
  const root: bip32.BIP32Interface = bip32FromSeedFunc(seed)
  root.network = network
  // treat a detected seed as an airbitz seed
  return isMnemonic
    ? root
      .deriveHardened(purpose)
      .deriveHardened(coinType)
      .deriveHardened(account)
      .toBase58()
    : root.derive(0).toBase58()
}

export function xprivToXPub(args: XPrivToXPubArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    networkType: args.network,
    coinString: args.coin,
    sigType: args.type,
  })
  const coin = getCoinFromString(args.coin)
  const bip32FromBase58Func = coin.bip32FromBase58Func ?? bip32.fromBase58
  return bip32FromBase58Func(args.xpriv, network).neutered().toBase58()
}

export function derivationLevelScriptHash(): number {
  // currently returns the derivation for an empty script template for a bitcoin cash
  // replay protection script (without key material)
  let hash: string = '0000'
  hash = bitcoin.crypto
    .hash160(Buffer.from(cdsScriptTemplates.replayProtection(''), 'hex'))
    .slice(0, 4)
    .toString('hex')
  return parseInt(hash, 16)
}

export function xpubToPubkey(args: XPubToPubkeyArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    networkType: args.network,
    coinString: args.coin,
    sigType: args.type,
  })
  const coin = getCoinFromString(args.coin)
  const bip32FromBase58Func = coin.bip32FromBase58Func ?? bip32.fromBase58
  const node: bip32.BIP32Interface = bip32FromBase58Func(args.xpub, network)
  return node
    .derive(args.bip44ChangeIndex)
    .derive(args.bip44AddressIndex)
    .publicKey.toString('hex')
}

export function addressToScriptPubkey(args: AddressToScriptPubkeyArgs): string {
  const legacy = args.legacy ?? false
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    networkType: args.network,
    coinString: args.coin,
    legacy: args.legacy,
  })
  const addressType: AddressTypeEnum = guessAddressTypeFromAddress(
    args.address,
    network,
    args.coin,
    args.addressType
  )
  const coinClass = getCoinFromString(args.coin)
  let payment: bitcoin.payments.PaymentCreator
  switch (addressType) {
    case AddressTypeEnum.p2pkh:
      if (
        (typeof coinClass.mainnetConstants.cashaddr !== 'undefined' &&
          !legacy) ||
        (typeof coinClass.legacyConstants !== 'undefined' &&
          typeof coinClass.legacyConstants.cashaddr !== 'undefined' &&
          legacy)
      ) {
        return scriptHashToScriptPubkey({
          scriptHash: cashAddressToHash(args.address).scriptHash.toString(
            'hex'
          ),
          network: args.network,
          scriptType: ScriptTypeEnum.p2pkh,
          coin: args.coin,
        })
      }
      payment = bitcoin.payments.p2pkh
      break
    case AddressTypeEnum.p2sh:
      if (
        (typeof coinClass.mainnetConstants.cashaddr !== 'undefined' &&
          !legacy) ||
        (typeof coinClass.legacyConstants !== 'undefined' &&
          typeof coinClass.legacyConstants.cashaddr !== 'undefined' &&
          legacy)
      ) {
        return scriptHashToScriptPubkey({
          scriptHash: cashAddressToHash(args.address).scriptHash.toString(
            'hex'
          ),
          network: args.network,
          scriptType: ScriptTypeEnum.p2sh,
          coin: args.coin,
        })
      }
      payment = bitcoin.payments.p2sh
      break
    case AddressTypeEnum.p2wpkh:
      payment = bitcoin.payments.p2wpkh
      break
    case AddressTypeEnum.p2wsh:
      payment = bitcoin.payments.p2wsh
      break
    default:
      throw new Error('invalid address type in address to script pubkey')
  }
  const scriptPubkey = payment({
    address: args.address,
    network: network,
    bs58DecodeFunc: coinClass.bs58DecodeFunc,
    bs58EncodeFunc: coinClass.bs58EncodeFunc,
  }).output
  if (typeof scriptPubkey === 'undefined') {
    throw new Error('failed converting address to scriptPubkey')
  }
  return scriptPubkey.toString('hex')
}

export function scriptPubkeyToAddress(
  args: ScriptPubkeyToAddressArgs
): ScriptPubkeyToAddressReturn {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    networkType: args.network,
    coinString: args.coin,
  })
  const legacyNetwork: BitcoinJSNetwork = bip32NetworkFromCoin({
    networkType: args.network,
    coinString: args.coin,
    legacy: true,
  })
  const coinClass = getCoinFromString(args.coin)
  let address: string | undefined
  let legacyAddress: string | undefined
  let payment: bitcoin.payments.PaymentCreator
  switch (args.addressType) {
    case AddressTypeEnum.p2pkh:
      if (typeof coinClass.mainnetConstants.cashaddr !== 'undefined') {
        address = hashToCashAddress(
          scriptPubkeyToScriptHash({
            scriptPubkey: args.scriptPubkey,
            network: args.network,
            scriptType: ScriptTypeEnum.p2pkh,
            coin: args.coin,
          }),
          CashaddrTypeEnum.pubkeyhash,
          args.network
        )
      }
      if (
        typeof coinClass.legacyConstants !== 'undefined' &&
        typeof coinClass.legacyConstants.cashaddr !== 'undefined'
      ) {
        legacyAddress = hashToCashAddress(
          scriptPubkeyToScriptHash({
            scriptPubkey: args.scriptPubkey,
            network: args.network,
            scriptType: ScriptTypeEnum.p2pkh,
            coin: args.coin,
          }),
          CashaddrTypeEnum.pubkeyhash,
          args.network
        )
      }
      payment = bitcoin.payments.p2pkh
      break
    case AddressTypeEnum.p2sh:
      if (typeof coinClass.mainnetConstants.cashaddr !== 'undefined') {
        address = hashToCashAddress(
          scriptPubkeyToScriptHash({
            scriptPubkey: args.scriptPubkey,
            network: args.network,
            scriptType: ScriptTypeEnum.p2sh,
            coin: args.coin,
          }),
          CashaddrTypeEnum.scripthash,
          args.network
        )
      }
      if (
        typeof coinClass.legacyConstants !== 'undefined' &&
        typeof coinClass.legacyConstants.cashaddr !== 'undefined'
      ) {
        address = hashToCashAddress(
          scriptPubkeyToScriptHash({
            scriptPubkey: args.scriptPubkey,
            network: args.network,
            scriptType: ScriptTypeEnum.p2sh,
            coin: args.coin,
          }),
          CashaddrTypeEnum.scripthash,
          args.network
        )
      }
      payment = bitcoin.payments.p2sh
      break
    case AddressTypeEnum.p2wpkh:
      payment = bitcoin.payments.p2wpkh
      break
    case AddressTypeEnum.p2wsh:
      payment = bitcoin.payments.p2wsh
      break
    default:
      throw new Error('invalid address type in address to script pubkey')
  }
  address =
    address ??
    payment({
      output: Buffer.from(args.scriptPubkey, 'hex'),
      network: network,
      bs58DecodeFunc: coinClass.bs58DecodeFunc,
      bs58EncodeFunc: coinClass.bs58EncodeFunc,
    }).address

  legacyAddress =
    legacyAddress ??
    payment({
      output: Buffer.from(args.scriptPubkey, 'hex'),
      network: legacyNetwork,
      bs58DecodeFunc: coinClass.bs58DecodeFunc,
      bs58EncodeFunc: coinClass.bs58EncodeFunc,
    }).address

  if (typeof address === 'undefined' || typeof legacyAddress === 'undefined') {
    throw new Error('failed converting scriptPubkey to address')
  }
  return { address, legacyAddress }
}

function scriptHashToScriptPubkey(args: ScriptHashToScriptPubkeyArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    networkType: args.network,
    coinString: args.coin,
  })
  let payment: bitcoin.payments.PaymentCreator
  switch (args.scriptType) {
    case ScriptTypeEnum.p2pkh:
      payment = bitcoin.payments.p2pkh
      break
    case ScriptTypeEnum.p2sh:
      payment = bitcoin.payments.p2sh
      break
    case ScriptTypeEnum.p2wpkh:
      payment = bitcoin.payments.p2wpkh
      break
    default:
      throw new Error('invalid address type in address to script pubkey')
  }
  const scriptPubkey: Buffer | undefined = payment({
    hash: Buffer.from(args.scriptHash, 'hex'),
    network: network,
  }).output
  if (typeof scriptPubkey === 'undefined') {
    throw new Error('failed converting scriptPubkey to address')
  }
  return scriptPubkey.toString('hex')
}

export function scriptPubkeyToScriptHash(
  args: ScriptPubkeyToScriptHashArgs
): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    networkType: args.network,
    coinString: args.coin,
  })
  let payment: bitcoin.payments.PaymentCreator
  switch (args.scriptType) {
    case ScriptTypeEnum.p2pkh:
      payment = bitcoin.payments.p2pkh
      break
    case ScriptTypeEnum.p2sh:
      payment = bitcoin.payments.p2sh
      break
    case ScriptTypeEnum.p2wpkh:
      payment = bitcoin.payments.p2wpkh
      break
    default:
      throw new Error('invalid address type in address to script pubkey')
  }
  const scriptHash: Buffer | undefined = payment({
    output: Buffer.from(args.scriptPubkey, 'hex'),
    network: network,
  }).hash
  if (typeof scriptHash === 'undefined') {
    throw new Error('failed converting scriptPubkey to address')
  }
  return scriptHash.toString('hex')
}

export function scriptPubkeyToP2SH(
  args: ScriptPubkeyToP2SHArgs
): ScriptPubkeyToP2SHReturn {
  const p2sh = bitcoin.payments.p2sh({
    redeem: {
      output: Buffer.from(args.scriptPubkey, 'hex'),
    },
  })
  if (
    typeof p2sh.output === 'undefined' ||
    typeof p2sh.redeem === 'undefined' ||
    typeof p2sh.redeem.output === 'undefined'
  ) {
    throw new Error('unable to convert script to p2sh')
  }
  return {
    scriptPubkey: p2sh.output.toString('hex'),
    redeemScript: p2sh.redeem.output.toString('hex'),
  }
}

export function pubkeyToScriptPubkey(
  args: PubkeyToScriptPubkeyArgs
): PubkeyToScriptPubkeyReturn {
  let payment: bitcoin.payments.Payment
  switch (args.scriptType) {
    case ScriptTypeEnum.p2pkh:
      payment = bitcoin.payments.p2pkh({
        pubkey: Buffer.from(args.pubkey, 'hex'),
      })
      if (typeof payment.output === 'undefined') {
        throw new Error('failed converting pubkey to script pubkey')
      }
      return { scriptPubkey: payment.output.toString('hex') }
    case ScriptTypeEnum.p2wpkhp2sh:
      return scriptPubkeyToP2SH({
        scriptPubkey: pubkeyToScriptPubkey({
          pubkey: args.pubkey,
          scriptType: ScriptTypeEnum.p2wpkh,
        }).scriptPubkey,
      })
    case ScriptTypeEnum.p2wpkh:
      payment = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(args.pubkey, 'hex'),
      })
      if (typeof payment.output === 'undefined') {
        throw new Error('failed converting pubkey to script pubkey')
      }
      return { scriptPubkey: payment.output.toString('hex') }
    default:
      throw new Error('invalid address type in pubkey to script pubkey')
  }
}

export function xprivToPrivateKey(args: XPrivToPrivateKeyArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    networkType: args.network,
    coinString: args.coin,
    sigType: args.type,
  })
  const coin = getCoinFromString(args.coin)
  const bip32FromBase58Func = coin.bip32FromBase58Func ?? bip32.fromBase58
  const node: bip32.BIP32Interface = bip32FromBase58Func(args.xpriv, network)
  const privateKey = node
    .derive(args.bip44ChangeIndex)
    .derive(args.bip44AddressIndex).privateKey
  if (typeof privateKey === 'undefined') {
    throw new Error('Failed to generate private key from xpriv')
  }
  return privateKey.toString('hex')
}

export function privateKeyToWIF(args: PrivateKeyToWIFArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    networkType: args.network,
    coinString: args.coin,
    forWIF: true,
  })
  const coinClass = getCoinFromString(args.coin)
  return bitcoin.ECPair.fromPrivateKey(Buffer.from(args.privateKey, 'hex'), {
    network,
  }).toWIF(coinClass.wifEncodeFunc)
}

export function wifToPrivateKey(args: WIFToPrivateKeyArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    networkType: args.network,
    coinString: args.coin,
    forWIF: true,
  })
  const coinClass = getCoinFromString(args.coin)
  const privateKey = bitcoin.ECPair.fromWIF(
    args.wifKey,
    network,
    coinClass.bs58DecodeFunc
  ).privateKey
  if (typeof privateKey === 'undefined') {
    throw new Error('Failed to convert WIF key to private key')
  }
  return privateKey.toString('hex')
}

export function privateKeyToPubkey(privateKey: string): string {
  return bitcoin.ECPair.fromPrivateKey(
    Buffer.from(privateKey, 'hex')
  ).publicKey.toString('hex')
}

// Electrum uses the hash of the script pubkey to discover balances and transactions
export function scriptPubkeyToElectrumScriptHash(scriptPubkey: string): string {
  return Buffer.from(
    bitcoin.crypto.sha256(Buffer.from(scriptPubkey, 'hex')).reverse()
  ).toString('hex')
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function makeTx(args: MakeTxArgs): Promise<MakeTxReturn> {
  let sequence: number = 0xffffffff
  if (args.rbf) {
    sequence -= 2
  }

  // get coin specific replay protection sighhash bits
  let sighashType = bitcoin.Transaction.SIGHASH_ALL
  const coin = getCoinFromString(args.coin)
  if (typeof coin.sighash !== 'undefined') {
    sighashType = coin.sighash
  }

  const mappedUtxos: utxopicker.UTXO[] = []
  for (const utxo of args.utxos) {
    // Cannot use a utxo without a script
    if (typeof utxo.script === 'undefined') continue
    const input: utxopicker.UTXO = {
      hash: Buffer.from(utxo.txid, 'hex').reverse(),
      index: utxo.vout,
      value: parseInt(utxo.value),
      script: Buffer.from(utxo.script, 'hex'),
      scriptType: utxo.scriptType,
      sequence,
      sighashType,
    }
    if (utxo.scriptType === ScriptTypeEnum.p2pkh) {
      input.nonWitnessUtxo = input.script
    } else {
      input.witnessUtxo = {
        script: input.script,
        value: parseInt(utxo.value),
      }

      if (typeof utxo.redeemScript !== 'undefined') {
        input.redeemScript = Buffer.from(utxo.redeemScript, 'hex')
      }
    }
    mappedUtxos.push(input)
  }

  const targets: utxopicker.Target[] = args.targets.map((target) => {
    const script = addressToScriptPubkey({
      address: target.address,
      coin: coin.name,
      network: args.network,
    })
    return {
      script,
      value: target.value,
    }
  })
  const changeScript = addressToScriptPubkey({
    address: args.freshChangeAddress,
    coin: coin.name,
    network: args.network,
  })
  const { inputs, outputs, changeUsed = false, fee } = utxopicker.accumulative(
    mappedUtxos,
    targets,
    args.feeRate,
    changeScript
  )
  if (!inputs || !outputs) {
    throw new Error('Make spend failed.')
  }

  const psbt = new bitcoin.Psbt()
  psbt.addInputs(inputs)
  psbt.addOutputs(outputs)

  return { psbt: psbt, changeUsed, fee }
}

export function createTx(args: CreateTxArgs): CreateTxReturn {
  const psbt = new bitcoin.Psbt()
  let sequence: number = 0xffffffff
  if (args.rbf) {
    sequence -= 2
  }
  let segwit: boolean = false
  let txVSize: number = 0

  // get coin specific replay protection sighhash bits
  let hashType = bitcoin.Transaction.SIGHASH_ALL
  if (typeof args.coin !== 'undefined') {
    const coin = getCoinFromString(args.coin)
    if (typeof coin.sighash !== 'undefined') {
      hashType = coin.sighash
    }
  }

  for (let i: number = 0; i < args.inputs.length; i++) {
    const input: TxInput = args.inputs[i]
    if (input.type === TransactionInputTypeEnum.Legacy) {
      if (typeof input.prevTx === 'undefined') {
        throw Error(
          'legacy inputs require the full previous transaction to be passed'
        )
      }
      if (typeof input.redeemScript === 'undefined') {
        psbt.addInput({
          hash: input.prevTxid,
          index: input.index,
          sequence: sequence,
          // non-segwit inputs now require passing the whole previous tx as Buffer
          nonWitnessUtxo: Buffer.from(input.prevTx, 'hex'),
          sighashType: hashType,
        })
        txVSize += 148
      } else {
        psbt.addInput({
          hash: input.prevTxid,
          index: input.index,
          sequence: sequence,
          // non-segwit inputs now require passing the whole previous tx as Buffer
          nonWitnessUtxo: Buffer.from(input.prevTx, 'hex'),
          sighashType: hashType,
          redeemScript: Buffer.from(input.redeemScript, 'hex'),
        })
        // this is a conservative estimate of the cds bitcoin cash sig type
        txVSize += 147
      }
    } else {
      segwit = true
      if (
        typeof input.prevScriptPubkey === 'undefined' ||
        typeof input.value === 'undefined'
      ) {
        throw Error(
          'segwit inputs require a script pubkey and value to be passed'
        )
      }

      if (typeof input.redeemScript === 'undefined') {
        psbt.addInput({
          hash: input.prevTxid,
          index: input.index,
          sequence: sequence,
          // add witnessUtxo for Segwit input type. The scriptPubkey and the value only are needed.
          witnessUtxo: {
            script: Buffer.from(input.prevScriptPubkey, 'hex'),
            value: input.value,
          },
          // by default this is SIGHASH_ALL, but can also be the tweaked sighash values for BCH and BTG
          sighashType: hashType,
        })
        // weight for p2pkh input
        txVSize += 67.75
        continue
      }

      psbt.addInput({
        hash: input.prevTxid,
        index: input.index,
        sequence: sequence,
        // add witnessUtxo for Segwit input type. The scriptPubkey and the value only are needed.
        witnessUtxo: {
          script: Buffer.from(input.prevScriptPubkey, 'hex'),
          value: input.value,
        },
        redeemScript: Buffer.from(input.redeemScript, 'hex'),
      })
      // weight for pwpkhp2sh input
      txVSize += 91
    }
  }
  for (let i: number = 0; i < args.outputs.length; i++) {
    psbt.addOutput({
      script: Buffer.from(args.outputs[i].scriptPubkey, 'hex'),
      value: args.outputs[i].amount,
    })
    if (args.outputs[i].scriptPubkey.length === 50) {
      // p2pkh output
      txVSize += 34
    } else if (args.outputs[i].scriptPubkey.length === 46) {
      txVSize += 32
    } else if (args.outputs[i].scriptPubkey.length === 44) {
      txVSize += 31
    }
  }
  if (segwit) {
    // segwit adds an additional 0.5 for the segwit transaction type flag and 0.25 for the number of witness elements
    txVSize += 10.75
  } else {
    txVSize += 10
  }
  // round up to the nearest whole number to avoid too low fees
  txVSize = Math.ceil(txVSize)
  return { psbt: psbt.toBase64(), vSize: txVSize }
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function signTx(args: SignTxArgs): Promise<string> {
  const psbt = bitcoin.Psbt.fromBase64(args.psbt)
  const coin = getCoinFromString(args.coin)

  for (let i = 0; i < psbt.inputCount; i++) {
    const privateKey = Buffer.from(args.privateKeys[i], 'hex')
    psbt.signInput(
      i,
      bitcoin.ECPair.fromPrivateKey(privateKey),
      bitcoin.Psbt.DEFAULT_SIGHASHES,
      coin.sighashFunction
    )
    psbt.validateSignaturesOfInput(i)
    psbt.finalizeInput(i)
  }
  console.log('-----------------------------------------')
  const tx = psbt.extractTransaction()
  console.log('bytes no witness after:', tx.byteLength(false))
  console.log('bytes witness after:', tx.byteLength())
  console.log('vbytes after:', tx.virtualSize())
  console.log('weight after:', tx.weight())
  console.log('fee:', psbt.getFee())
  console.log('feeRate:', psbt.getFeeRate())
  console.log('-----------------------------------------')
  return psbt.extractTransaction().toHex()
}
