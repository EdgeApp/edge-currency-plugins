/* eslint-disable camelcase */
import * as bitcoin from 'altcoin-js'
import * as bip32 from 'bip32'
import * as bip39 from 'bip39'
import bitcoinMessage from 'bitcoinjs-message'
import { InsufficientFundsError } from 'edge-core-js/types'

import { CoinInfo, CoinPrefixes } from '../../plugin/types'
import { IUTXO } from '../db/types'
import { ScriptTemplate } from '../info/scriptTemplates/types'
import {
  cashAddressToHash,
  CashaddrTypeEnum,
  hashToCashAddress
} from './bitcoincashUtils/cashAddress'
import { getCoinFromString } from './coinmapper'
import * as utxopicker from './utxopicker'

// in bitcoin these are bip44, bip49, bip84 xpub prefixes
// other coins contain different formats which still need to be gathered.
export enum BIP43PurposeTypeEnum {
  Airbitz = 'airbitz',
  Legacy = 'legacy', // xpub/xprv tpub/tprv etc.
  Segwit = 'segwit', // zpub/zprv vpub/vprv etc.
  WrappedSegwit = 'wrappedSegwit' // ypub/yprv upub/uprv etc.
}

// supported address types.
export enum AddressTypeEnum {
  p2pkh = 'p2pkh',
  p2sh = 'p2sh',
  p2wpkh = 'p2wpkh', // short bech32 address
  p2wsh = 'p2wsh' // long bech32 address
}

export enum ScriptTypeEnum {
  p2wpkh = 'p2wpkh',
  p2wpkhp2sh = 'p2wpkhp2sh',
  p2wsh = 'p2wsh',
  p2pk = 'p2pk',
  p2pkh = 'p2pkh',
  p2sh = 'p2sh',
  replayProtection = 'replayprotection',
  replayProtectionP2SH = 'replayprotectionp2sh'
}

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
  coin: string
  redeemScript?: string
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

export interface WIFToPrivateKeyArgs {
  wifKey: string
  coin: string
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

export interface CreateTxArgs {
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
  forceUseUtxo: IUTXO[]
  utxos: IUTXO[]
  targets: MakeTxTarget[]
  feeRate: number
  setRBF: boolean
  coin: string
  freshChangeAddress: string
  subtractFee?: boolean
}

export interface MakeTxTarget {
  address: string
  value: number
}

interface MakeTxReturn extends Required<utxopicker.UtxoPickerResult> {
  psbtBase64: string
}

export interface SignTxArgs {
  privateKeys: string[]
  psbtBase64: string
  coin: string
}

interface SignTxReturn {
  id: string
  hex: string
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

function bip32NetworkFromCoinPrefix(
  sigType: BIP43PurposeTypeEnum,
  coinPrefixes: CoinPrefixes,
  _segwit: boolean,
  forWIF: boolean
): BitcoinJSNetwork {
  let xKeyPrefixes: Bip32
  switch (sigType) {
    case BIP43PurposeTypeEnum.Segwit:
      if (coinPrefixes.segwitXPub == null || coinPrefixes.segwitXPriv == null) {
        throw new Error('segwit xpub prefix is undefined')
      }
      xKeyPrefixes = {
        public: coinPrefixes.segwitXPub,
        private: coinPrefixes.segwitXPriv
      }
      break
    case BIP43PurposeTypeEnum.WrappedSegwit:
      if (
        coinPrefixes.wrappedSegwitXPub == null ||
        coinPrefixes.wrappedSegwitXPriv == null
      ) {
        throw new Error('wrapped segwit xpub prefix is undefined')
      }
      xKeyPrefixes = {
        public: coinPrefixes.wrappedSegwitXPub,
        private: coinPrefixes.wrappedSegwitXPriv
      }
      break
    case BIP43PurposeTypeEnum.Legacy:
    case BIP43PurposeTypeEnum.Airbitz:
      xKeyPrefixes = {
        public: coinPrefixes.legacyXPub,
        private: coinPrefixes.legacyXPriv
      }
      break
    default:
      throw new Error('invalid bip43 purpose type')
  }

  const bech32: string = coinPrefixes.bech32 ?? 'bc'
  if (forWIF) {
    return {
      messagePrefix: coinPrefixes.messagePrefix,
      wif: coinPrefixes.wif,
      bip32: xKeyPrefixes,
      bech32: bech32,
      pubKeyHash: coinPrefixes.pubkeyHash,
      scriptHash: coinPrefixes.scriptHash
    }
  }
  return {
    messagePrefix: coinPrefixes.messagePrefix,
    wif: 0x80,
    bip32: xKeyPrefixes,
    bech32: bech32,
    pubKeyHash: coinPrefixes.pubkeyHash,
    scriptHash: coinPrefixes.scriptHash
  }
}

function bip32NetworkFromCoin(
  args: Bip32NetworkFromCoinArgs
): BitcoinJSNetwork {
  const sigType = args.sigType ?? BIP43PurposeTypeEnum.Legacy
  const forWIF: boolean = args.forWIF ?? false
  const legacy: boolean = args.legacy ?? false
  const coin: CoinInfo = getCoinFromString(args.coinString)
  if (legacy && coin.legacyConstants != null) {
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
      coinString: args.coin
    })
    guessAddressTypeFromAddress(args.address, network, args.coin, undefined)
    return VerifyAddressEnum.good
  } catch (e) {}
  try {
    const network: BitcoinJSNetwork = bip32NetworkFromCoin({
      coinString: args.coin,
      legacy: true
    })
    guessAddressTypeFromAddress(args.address, network, args.coin, undefined)
    return VerifyAddressEnum.legacy
  } catch (e) {}
  return VerifyAddressEnum.bad
}

function getCashAddrPrefixes(coinInfo: CoinInfo): string[] {
  const prefixes: string[] = []
  if (coinInfo.mainnetConstants.cashaddr != null) {
    prefixes.push(coinInfo.mainnetConstants.cashaddr)
  }
  if (coinInfo.legacyConstants?.cashaddr != null) {
    prefixes.push(coinInfo.legacyConstants.cashaddr)
  }
  return prefixes
}

function guessAddressTypeFromAddress(
  address: string,
  network: BitcoinJSNetwork,
  coin: string,
  addressType: AddressTypeEnum | undefined
): AddressTypeEnum {
  if (addressType != null) {
    return addressType
  }
  const coinClass: CoinInfo = getCoinFromString(coin)
  try {
    bitcoin.payments.p2pkh({
      address,
      network,
      bs58DecodeFunc: coinClass.bs58DecodeFunc,
      bs58EncodeFunc: coinClass.bs58EncodeFunc
    })
    return AddressTypeEnum.p2pkh
  } catch (e) {}
  try {
    bitcoin.payments.p2sh({
      address,
      network,
      bs58DecodeFunc: coinClass.bs58DecodeFunc,
      bs58EncodeFunc: coinClass.bs58EncodeFunc
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
  throw new Error('Could not determine address type of ' + address)
}

export function seedOrMnemonicToXPriv(args: SeedOrMnemonicToXPrivArgs): string {
  // match hexadecimal number from beginning to end of string
  const isMnemonic = args.seed.includes(' ')
  const seed = isMnemonic
    ? bip39.mnemonicToSeedSync(args.seed)
    : Buffer.from(args.seed, 'base64')
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    sigType: args.type
  })
  const coin = getCoinFromString(args.coin)
  const purpose = bip43PurposeTypeEnumToNumber(args.type)
  const coinType = args.coinType ?? coin.coinType
  const account = args.account ?? 0
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
    coinString: args.coin,
    sigType: args.type
  })
  const coin = getCoinFromString(args.coin)
  const bip32FromBase58Func = coin.bip32FromBase58Func ?? bip32.fromBase58
  return bip32FromBase58Func(args.xpriv, network).neutered().toBase58()
}

export function derivationLevelScriptHash(
  scriptTemplate: ScriptTemplate
): number {
  // currently returns the derivation for an empty script template for a bitcoin cash
  // replay protection script (without key material)
  let hash = '0000'
  hash = bitcoin.crypto
    .hash160(Buffer.from(scriptTemplate(''), 'hex'))
    .slice(0, 4)
    .toString('hex')
  return parseInt(hash, 16)
}

export function xpubToPubkey(args: XPubToPubkeyArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    sigType: args.type
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
    coinString: args.coin,
    legacy: args.legacy
  })
  const addressType: AddressTypeEnum = guessAddressTypeFromAddress(
    args.address,
    network,
    args.coin,
    args.addressType
  )
  const coinClass = getCoinFromString(args.coin)
  const cashAddrPrefixes = getCashAddrPrefixes(coinClass)
  let payment: bitcoin.payments.PaymentCreator
  switch (addressType) {
    case AddressTypeEnum.p2pkh:
      if (
        (coinClass.mainnetConstants.cashaddr != null && !legacy) ||
        (coinClass.legacyConstants?.cashaddr != null && legacy)
      ) {
        return scriptHashToScriptPubkey({
          scriptHash: cashAddressToHash(
            args.address,
            cashAddrPrefixes
          ).scriptHash.toString('hex'),
          scriptType: ScriptTypeEnum.p2pkh,
          coin: args.coin
        })
      }
      payment = bitcoin.payments.p2pkh
      break
    case AddressTypeEnum.p2sh:
      if (
        (coinClass.mainnetConstants.cashaddr != null && !legacy) ||
        (coinClass.legacyConstants?.cashaddr != null && legacy)
      ) {
        return scriptHashToScriptPubkey({
          scriptHash: cashAddressToHash(
            args.address,
            cashAddrPrefixes
          ).scriptHash.toString('hex'),
          scriptType: ScriptTypeEnum.p2sh,
          coin: args.coin
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
    bs58EncodeFunc: coinClass.bs58EncodeFunc
  }).output
  if (scriptPubkey == null) {
    throw new Error('failed converting address to scriptPubkey')
  }
  return scriptPubkey.toString('hex')
}

export function scriptPubkeyToAddress(
  args: ScriptPubkeyToAddressArgs
): ScriptPubkeyToAddressReturn {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin
  })
  const legacyNetwork: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    legacy: true
  })
  const coinClass = getCoinFromString(args.coin)
  let address: string | undefined
  let legacyAddress: string | undefined
  let payment: bitcoin.payments.PaymentCreator
  switch (args.addressType) {
    case AddressTypeEnum.p2pkh:
      if (coinClass.mainnetConstants.cashaddr != null) {
        address = hashToCashAddress(
          scriptPubkeyToScriptHash({
            scriptPubkey: args.scriptPubkey,
            scriptType: ScriptTypeEnum.p2pkh,
            coin: args.coin
          }),
          CashaddrTypeEnum.pubkeyhash,
          coinClass.mainnetConstants.cashaddr
        )
      }
      if (coinClass.legacyConstants?.cashaddr != null) {
        legacyAddress = hashToCashAddress(
          scriptPubkeyToScriptHash({
            scriptPubkey: args.scriptPubkey,
            scriptType: ScriptTypeEnum.p2pkh,
            coin: args.coin
          }),
          CashaddrTypeEnum.pubkeyhash,
          coinClass.legacyConstants.cashaddr
        )
      }
      payment = bitcoin.payments.p2pkh
      break
    case AddressTypeEnum.p2sh:
      if (coinClass.mainnetConstants.cashaddr != null) {
        address = hashToCashAddress(
          scriptPubkeyToScriptHash({
            scriptPubkey: args.scriptPubkey,
            scriptType: ScriptTypeEnum.p2sh,
            coin: args.coin
          }),
          CashaddrTypeEnum.scripthash,
          coinClass.mainnetConstants.cashaddr
        )
      }
      if (coinClass.legacyConstants?.cashaddr != null) {
        address = hashToCashAddress(
          scriptPubkeyToScriptHash({
            scriptPubkey: args.scriptPubkey,
            scriptType: ScriptTypeEnum.p2sh,
            coin: args.coin
          }),
          CashaddrTypeEnum.scripthash,
          coinClass.legacyConstants.cashaddr
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

  if (address == null || legacyAddress == null) {
    throw new Error('failed converting scriptPubkey to address')
  }
  return { address, legacyAddress }
}

function scriptHashToScriptPubkey(args: ScriptHashToScriptPubkeyArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin
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
    network: network
  }).output
  if (scriptPubkey == null) {
    throw new Error('failed converting scriptPubkey to address')
  }
  return scriptPubkey.toString('hex')
}

export function scriptPubkeyToScriptHash(
  args: ScriptPubkeyToScriptHashArgs
): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin
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
    network: network
  }).hash
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
      coinString: coin
    })
  }
  const p2sh = bitcoin.payments.p2sh({
    network: bip32Network,
    redeem: {
      output: Buffer.from(scriptPubkey, 'hex')
    }
  })
  if (p2sh.output == null || p2sh.redeem?.output == null) {
    throw new Error('unable to convert script to p2sh')
  }
  return {
    scriptPubkey: p2sh.output.toString('hex'),
    redeemScript: p2sh.redeem.output.toString('hex'),
    address: p2sh.address
  }
}

export function pubkeyToScriptPubkey(
  args: PubkeyToScriptPubkeyArgs
): PubkeyToScriptPubkeyReturn {
  let payment: bitcoin.payments.Payment
  switch (args.scriptType) {
    case ScriptTypeEnum.p2pkh:
      payment = bitcoin.payments.p2pkh({
        pubkey: Buffer.from(args.pubkey, 'hex')
      })
      if (payment.output == null) {
        throw new Error('failed converting pubkey to script pubkey')
      }
      return { scriptPubkey: payment.output.toString('hex') }
    case ScriptTypeEnum.p2wpkhp2sh:
      return scriptPubkeyToP2SH({
        scriptPubkey: pubkeyToScriptPubkey({
          pubkey: args.pubkey,
          scriptType: ScriptTypeEnum.p2wpkh
        }).scriptPubkey
      })
    case ScriptTypeEnum.p2wpkh:
      payment = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(args.pubkey, 'hex')
      })
      if (payment.output == null) {
        throw new Error('failed converting pubkey to script pubkey')
      }
      return { scriptPubkey: payment.output.toString('hex') }
    default:
      throw new Error('invalid address type in pubkey to script pubkey')
  }
}

export function xprivToPrivateKey(args: XPrivToPrivateKeyArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    sigType: args.type
  })
  const coin = getCoinFromString(args.coin)
  const bip32FromBase58Func = coin.bip32FromBase58Func ?? bip32.fromBase58
  const node: bip32.BIP32Interface = bip32FromBase58Func(args.xpriv, network)
  const privateKey = node
    .derive(args.bip44ChangeIndex)
    .derive(args.bip44AddressIndex).privateKey
  if (privateKey == null) {
    throw new Error('Failed to generate private key from xpriv')
  }
  return privateKey.toString('hex')
}

export function privateKeyToWIF(args: PrivateKeyToWIFArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    forWIF: true
  })
  const coinClass = getCoinFromString(args.coin)
  return bitcoin.ECPair.fromPrivateKey(Buffer.from(args.privateKey, 'hex'), {
    network
  }).toWIF(coinClass.wifEncodeFunc)
}

export function wifToPrivateKey(args: WIFToPrivateKeyArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin({
    coinString: args.coin,
    forWIF: true
  })
  const coinClass = getCoinFromString(args.coin)
  const privateKey = bitcoin.ECPair.fromWIF(
    args.wifKey,
    network,
    coinClass.bs58DecodeFunc
  ).privateKey
  if (privateKey == null) {
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

export function signMessageBase64(message: string, privateKey: string): string {
  const keyPair = bitcoin.ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'))
  if (keyPair.privateKey == null) {
    throw new Error('Address could not sign message')
  }
  return bitcoinMessage
    .sign(message, keyPair.privateKey, keyPair.compressed)
    .toString('base64')
}

export async function makeTx(args: MakeTxArgs): Promise<MakeTxReturn> {
  let sequence = 0xffffffff
  if (args.setRBF) {
    sequence -= 2
  }

  // get coin specific replay protection sighhash bits
  let sighashType = bitcoin.Transaction.SIGHASH_ALL
  const coin = getCoinFromString(args.coin)
  if (coin.sighash != null) {
    sighashType = coin.sighash
  }

  const useUtxos: utxopicker.UTXO[] = []
  const mappedUtxos: utxopicker.UTXO[] = []

  const mergedArray = [...args.utxos, ...args.forceUseUtxo]
  const uniqueUtxos = [
    ...mergedArray
      .reduce((map, obj) => map.set(obj.id, obj), new Map<string, IUTXO>())
      .values()
  ]

  for (const utxo of uniqueUtxos) {
    // Cannot use a utxo without a script
    if (utxo.script == null) continue
    const input: utxopicker.UTXO = {
      hash: Buffer.from(utxo.txid, 'hex').reverse(),
      index: utxo.vout,
      value: parseInt(utxo.value),
      script: Buffer.from(utxo.script, 'hex'),
      scriptType: utxo.scriptType,
      sequence,
      sighashType
    }
    if (utxo.scriptType === ScriptTypeEnum.p2pkh) {
      input.nonWitnessUtxo = input.script
    } else {
      input.witnessUtxo = {
        script: input.script,
        value: parseInt(utxo.value)
      }

      if (utxo.redeemScript != null) {
        input.redeemScript = Buffer.from(utxo.redeemScript, 'hex')
      }
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

  const targets: utxopicker.Target[] = args.targets.map(target => {
    const script = addressToScriptPubkey({
      address: target.address,
      coin: coin.name
    })
    return {
      script,
      value: target.value
    }
  })
  const changeScript = addressToScriptPubkey({
    address: args.freshChangeAddress,
    coin: coin.name
  })

  const utxoPicker = coin.utxoPicker ?? utxopicker.utxoPicker

  const utxopicking =
    args.forceUseUtxo != null ?? false
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
  if (result.inputs == null || result.outputs == null) {
    throw new InsufficientFundsError(args.coin)
  }

  const psbt = new bitcoin.Psbt()
  psbt.addInputs(result.inputs)
  psbt.addOutputs(result.outputs)

  return {
    inputs: result.inputs,
    outputs: result.outputs,
    changeUsed: result.changeUsed,
    fee: result.fee,
    psbtBase64: psbt.toBase64()
  }
}

export function createTx(args: CreateTxArgs): CreateTxReturn {
  const psbt = new bitcoin.Psbt()
  let sequence = 0xffffffff
  if (args.rbf) {
    sequence -= 2
  }
  let segwit = false
  let txVSize = 0

  // get coin specific replay protection sighhash bits
  let hashType = bitcoin.Transaction.SIGHASH_ALL
  if (args.coin != null) {
    const coin = getCoinFromString(args.coin)
    if (coin.sighash != null) {
      hashType = coin.sighash
    }
  }

  for (let i = 0; i < args.inputs.length; i++) {
    const input: TxInput = args.inputs[i]
    if (input.type === TransactionInputTypeEnum.Legacy) {
      if (input.prevTx == null) {
        throw Error(
          'legacy inputs require the full previous transaction to be passed'
        )
      }
      if (input.redeemScript == null) {
        psbt.addInput({
          hash: input.prevTxid,
          index: input.index,
          sequence: sequence,
          // non-segwit inputs now require passing the whole previous tx as Buffer
          nonWitnessUtxo: Buffer.from(input.prevTx, 'hex'),
          sighashType: hashType
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
          redeemScript: Buffer.from(input.redeemScript, 'hex')
        })
        // this is a conservative estimate of the cds bitcoin cash sig type
        txVSize += 147
      }
    } else {
      segwit = true
      if (input.prevScriptPubkey == null || input.value == null) {
        throw Error(
          'segwit inputs require a script pubkey and value to be passed'
        )
      }

      if (input.redeemScript == null) {
        psbt.addInput({
          hash: input.prevTxid,
          index: input.index,
          sequence: sequence,
          // add witnessUtxo for Segwit input type. The scriptPubkey and the value only are needed.
          witnessUtxo: {
            script: Buffer.from(input.prevScriptPubkey, 'hex'),
            value: input.value
          },
          // by default this is SIGHASH_ALL, but can also be the tweaked sighash values for BCH and BTG
          sighashType: hashType
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
          value: input.value
        },
        redeemScript: Buffer.from(input.redeemScript, 'hex')
      })
      // weight for pwpkhp2sh input
      txVSize += 91
    }
  }
  for (let i = 0; i < args.outputs.length; i++) {
    psbt.addOutput({
      script: Buffer.from(args.outputs[i].scriptPubkey, 'hex'),
      value: args.outputs[i].amount
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

export async function signTx(args: SignTxArgs): Promise<SignTxReturn> {
  const psbt = bitcoin.Psbt.fromBase64(args.psbtBase64)
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
  return {
    id: tx.getId(),
    hex: tx.toHex()
  }
}
