/* eslint-disable camelcase */
import * as bip32 from 'bip32'
import * as bip32grs from 'bip32grs'
import * as bip39 from 'bip39'
import * as bitcoin from 'altcoin-js'

import {
  cashAddressToHash,
  CashaddrPrefixEnum,
  CashaddrTypeEnum,
  hashToCashAddress
} from './bitcoincashUtils/cashAddress'
import { cdsScriptTemplates } from './bitcoincashUtils/checkdatasig'
import { Coin, CoinPrefixes } from './coin'
import { getCoinFromString } from './coinmapper'
import * as utxopicker from './utxopicker'
import { IUTXO } from '../db/types'

// this enumerates the network types of single coins. Can be expanded to add regtest, signet, stagenet etc.
export enum NetworkEnum {
  Mainnet = 'mainnet',
  Testnet = 'testnet',
}

// in bitcoin these are bip44, bip49, bip84 xpub prefixes
// other coins contain different formats which still need to be gathered.
export enum BIP43PurposeTypeEnum {
  Airbitz = 'airbitz',
  Legacy = 'legacy', // xpub/xprv tpub/tprv etc.
  Segwit = 'segwit', // zpub/zprv vpub/vprv etc.
  WrappedSegwit = 'wrappedSegwit', // ypub/yprv upub/uprv etc.
}

export const BIP43NameToPurposeType: { [format: string]: BIP43PurposeTypeEnum } = {
  bip32: BIP43PurposeTypeEnum.Airbitz,
  bip44: BIP43PurposeTypeEnum.Legacy,
  bip49: BIP43PurposeTypeEnum.WrappedSegwit,
  bip84: BIP43PurposeTypeEnum.Segwit
}

export const BIP43PurposeTypeToName: { [type: string]: string } = {
  [BIP43PurposeTypeEnum.Airbitz]: 'bip32',
  [BIP43PurposeTypeEnum.Legacy]: 'bip44',
  [BIP43PurposeTypeEnum.WrappedSegwit]: 'bip49',
  [BIP43PurposeTypeEnum.Segwit]: 'bip84'
}

// supported address types.
export enum AddressTypeEnum {
  p2pkh = 'p2pkh',
  p2sh = 'p2sh',
  p2wpkh = 'p2wpkh', // short bech32 address
  p2wsh = 'p2wsh', // long bech32 address
  cashaddrP2PKH = 'cashaddrP2PKH',
  cashaddrP2SH = 'cashaddrP2SH',
}

export enum AddressFormatEnum {
  Legacy = 'legacy',
  New = 'new'
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

interface BaseArgs {
  network: NetworkEnum
  coin: string
}

interface AddressToAddressTypeArgs {
  address: string
  network: NetworkEnum
  coin: string
}

interface AddressTypeResponse {
  type: AddressTypeEnum
  format: AddressFormatEnum
}

export interface MnemonicToXPrivArgs extends BaseArgs {
  mnemonic: string
  path: string
  type: BIP43PurposeTypeEnum
}

export interface LegacySeedToPrivateKeyArgs {
  seed: string
  index: number
}

export interface XPrivToXPubArgs extends BaseArgs {
  xpriv: string
  type: BIP43PurposeTypeEnum
}

interface PurposeTypeToBip32NodeArgs extends BaseArgs {
  key: string
  type: BIP43PurposeTypeEnum
  changeIndex: 0 | 1
  addressIndex: number
}

export interface XPrivToPrivateKeyArgs extends Omit<PurposeTypeToBip32NodeArgs, 'key'> {
  xpriv: string
}

export interface XPubToPubkeyArgs extends Omit<PurposeTypeToBip32NodeArgs, 'key'> {
  xpub: string
}

export interface AddressToScriptPubkeyArgs extends BaseArgs {
  address: string
}

interface AddressToFormatArgs extends BaseArgs {
  address: string
  format: AddressFormatEnum
}

export interface PubkeyToScriptPubkeyArgs {
  pubkey: string
  scriptType: ScriptTypeEnum
}

export interface PubkeyToScriptPubkeyReturn {
  scriptPubkey: string
  redeemScript?: string
}

export interface ScriptPubkeyToAddressArgs extends BaseArgs {
  scriptPubkey: string
  addressType: AddressTypeEnum
  redeemScript?: string
}

// Careful! Calling this the ScriptHash is only correct for p2sh addresses.
// For p2pkh and p2wpkh this is just the pubkey hash.
// To get the script hash as used by electrum servers, follow their docs here:
// https://electrumx.readthedocs.io/en/latest/protocol-basics.html#script-hashes
// and use to scriptPubkeyToElectrumScriptHash function
export interface ScriptPubkeyToScriptHashArgs extends BaseArgs {
  scriptPubkey: string
  scriptType: ScriptTypeEnum
}

export interface ScriptPubkeyToP2SHArgs {
  scriptPubkey: string
}

export interface ScriptPubkeyToP2SHReturn {
  scriptPubkey: string
  redeemScript: string
}

interface ScriptHashToScriptPubkeyArgs extends BaseArgs {
  scriptHash: string
  scriptType: ScriptTypeEnum
}

export interface WIFToPrivateKeyArgs extends BaseArgs {
  wifKey: string
}

export interface PrivateKeyToWIFArgs extends BaseArgs {
  privateKey: string
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
interface BitcoinJSNetwork {
  wif: number
  bip32: Bip32
  messagePrefix: string
  bech32: string
  pubKeyHash: number
  scriptHash: number
  legacyPubKeyHash?: number
  legacyScriptHash?: number
}

interface Bip32 {
  public: number
  private: number
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
      legacyPubKeyHash: coinPrefixes.legacyPubkeyHash,
      legacyScriptHash: coinPrefixes.legacyScriptHash,
    }
  }
  return {
    messagePrefix: coinPrefixes.messagePrefix,
    wif: 0x80,
    bip32: xKeyPrefixes,
    bech32: bech32,
    pubKeyHash: coinPrefixes.pubkeyHash,
    scriptHash: coinPrefixes.scriptHash,
    legacyPubKeyHash: coinPrefixes.legacyPubkeyHash,
    legacyScriptHash: coinPrefixes.legacyScriptHash,
  }
}

export function bip32NetworkFromCoin(
  networkType: NetworkEnum,
  coinString: string,
  sigType: BIP43PurposeTypeEnum = BIP43PurposeTypeEnum.Legacy,
  forWIF: boolean = false
): BitcoinJSNetwork {
  const coin: Coin = getCoinFromString(coinString)
  if (networkType === NetworkEnum.Testnet) {
    return bip32NetworkFromCoinPrefix(
      sigType,
      coin.testnetConstants,
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

export function addressToAddressType(args: AddressToAddressTypeArgs): AddressTypeResponse {
  const network = bip32NetworkFromCoin(args.network, args.coin)
  const coinClass: Coin = getCoinFromString(args.coin)

  if (args.coin === 'bitcoincash') {
    let type: AddressTypeEnum
    let format: AddressFormatEnum
    try {
      const hashResult = cashAddressToHash(args.address)
      type = hashResult.type === CashaddrTypeEnum.pubkeyhash
        ? AddressTypeEnum.cashaddrP2PKH
        : AddressTypeEnum.cashaddrP2SH
      format = AddressFormatEnum.New
    } catch (e) {
      type = isP2PKH({ address: args.address })
        ? AddressTypeEnum.cashaddrP2PKH
        : AddressTypeEnum.cashaddrP2SH
      format = AddressFormatEnum.Legacy
    }

    return {
      type,
      format
    }
  }

  const payment: bitcoin.Payment = {
    address: args.address,
    network,
    bs58DecodeFunc: coinClass.bs58DecodeFunc,
    bs58EncodeFunc: coinClass.bs58EncodeFunc,
  }
  const legacyPayment: bitcoin.Payment = {
    ...payment,
    network: {
      ...network,
      pubKeyHash: network.legacyPubKeyHash!,
      scriptHash: network.legacyScriptHash!
    }
  }

  if (isP2PKH(legacyPayment)) {
    return {
      type: AddressTypeEnum.p2pkh,
      format: AddressFormatEnum.Legacy
    }
  }
  if (isP2PKH(payment)) {
    return {
      type: AddressTypeEnum.p2pkh,
      format: AddressFormatEnum.New
    }
  }
  if (isP2WPKHP2SH(legacyPayment)) {
    let expected = args.address
    try {
      expected = bitcoin.payments.p2sh({
        network: legacyPayment.network,
        hash: bitcoin.address.fromBase58Check(args.address, coinClass.bs58DecodeFunc).hash
      }).address!
    } catch (e) {}
    const format = expected === args.address
      ? AddressFormatEnum.Legacy
      : AddressFormatEnum.New
    return {
      type: AddressTypeEnum.p2sh,
      format
    }
  }
  if (isP2WPKHP2SH(payment)) {
    return {
      type: AddressTypeEnum.p2sh,
      format: AddressFormatEnum.New
    }
  }
  if (isP2SH(legacyPayment)) {
    return {
      type: AddressTypeEnum.p2sh,
      format: AddressFormatEnum.Legacy
    }
  }
  if (isP2SH(payment)) {
    return {
      type: AddressTypeEnum.p2sh,
      format: AddressFormatEnum.New
    }
  }
  if (isP2WSH(legacyPayment)) {
    return {
      type: AddressTypeEnum.p2wpkh,
      format: AddressFormatEnum.Legacy
    }
  }
  if (isP2WPKH(payment)) {
    return {
      type: AddressTypeEnum.p2wpkh,
      format: AddressFormatEnum.New
    }
  }
  if (isP2WSH(payment)) {
    return {
      type: AddressTypeEnum.p2wsh,
      format: AddressFormatEnum.New
    }
  }

  throw new Error('Could not determine address type of ' + args.address)
}

function isPaymentFactory(creator: bitcoin.PaymentCreator): (payment: bitcoin.Payment) => boolean {
  return (payment: bitcoin.Payment): boolean => {
    try {
      creator(payment)
      return true
    } catch (err) {
      return false
    }
  };
}
const isP2MS = isPaymentFactory(bitcoin.payments.p2ms)
const isP2WSH = isPaymentFactory(bitcoin.payments.p2wsh)
const isP2WPKH = isPaymentFactory(bitcoin.payments.p2wpkh)
const isP2WPKHP2SH = (redeem: bitcoin.Payment) =>
  isPaymentFactory(bitcoin.payments.p2sh)({ redeem })
const isP2SH = (payment: bitcoin.Payment) =>
  !isP2WPKHP2SH(payment) && isPaymentFactory(bitcoin.payments.p2sh)(payment)
const isP2PKH = isPaymentFactory(bitcoin.payments.p2pkh)
const isP2PK = isPaymentFactory(bitcoin.payments.p2pk)

export function scriptPubkeyToType(scriptPubkey: string): ScriptTypeEnum {
  const output = Buffer.from(scriptPubkey, 'hex')

  if (isP2PK({ output })) {
    return ScriptTypeEnum.p2pk
  }
  if (isP2PKH({ output })) {
    return ScriptTypeEnum.p2pkh
  }
  if (isP2SH({ output })) {
    return ScriptTypeEnum.p2sh
  }
  if (isP2WPKHP2SH({ output })) {
    return ScriptTypeEnum.p2wpkhp2sh
  }
  if (isP2WSH({ output })) {
    return ScriptTypeEnum.p2wsh
  }
  if (isP2WPKH({ output })) {
    return ScriptTypeEnum.p2wpkh
  }

  throw new Error('Could not determine scriptPubkey type of ' + scriptPubkey)
}

export function addressTypeToPurpose(type: AddressTypeEnum): BIP43PurposeTypeEnum {
  switch (type) {
    case AddressTypeEnum.p2pkh:
    case AddressTypeEnum.cashaddrP2PKH:
      return BIP43PurposeTypeEnum.Legacy

    case AddressTypeEnum.p2sh:
    case AddressTypeEnum.cashaddrP2SH:
      return BIP43PurposeTypeEnum.WrappedSegwit

    case AddressTypeEnum.p2wpkh:
    case AddressTypeEnum.p2wsh:
      return BIP43PurposeTypeEnum.Segwit

    default:
      throw new Error('Invalid address type')
  }
}

export function airbitzSeedToXPriv(seed: string): string {
  const xpriv = bip32
    .fromSeed(Buffer.from(seed, 'hex'))
    .derivePath('m/0')
    .toBase58()
  if (typeof xpriv === 'undefined') {
    throw new Error('Failed to generate xpriv from legacy seed')
  }
  return xpriv
}

export function airbitzSeedToPrivateKey(
  args: LegacySeedToPrivateKeyArgs
): string {
  const privateKey = bip32
    .fromSeed(Buffer.from(args.seed, 'hex'))
    .derivePath('m/0/0')
    .derive(args.index).privateKey
  if (typeof privateKey === 'undefined') {
    throw new Error('Failed to generate private key from legacy seed')
  }
  return privateKey.toString('hex')
}

export function mnemonicToXPriv(args: MnemonicToXPrivArgs): string {
  const seed = bip39.mnemonicToSeedSync(args.mnemonic)
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    args.network,
    args.coin,
    args.type
  )
  if (args.coin === 'groestlcoin') {
    const root: bip32.BIP32Interface = bip32grs.fromSeed(seed)
    root.network = network
    return root.derivePath(args.path).toBase58()
  }
  const root: bip32.BIP32Interface = bip32.fromSeed(seed)
  root.network = network
  return root.derivePath(args.path).toBase58()
}

export function xprivToXPub(args: XPrivToXPubArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    args.network,
    args.coin,
    args.type
  )
  if (args.coin === 'groestlcoin') {
    return bip32grs.fromBase58(args.xpriv, network).neutered().toBase58()
  }
  return bip32.fromBase58(args.xpriv, network).neutered().toBase58()
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

function bip32NodeFromPurposeType(args: PurposeTypeToBip32NodeArgs): bip32.BIP32Interface {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    args.network,
    args.coin,
    args.type
  )

  if (args.coin === 'groestlcoin') {
    return bip32grs.fromBase58(args.key, network)
      .derive(args.changeIndex)
      .derive(args.addressIndex)
  } else {
    const xprivNode: bip32.BIP32Interface = bip32.fromBase58(args.key, network)
    if (args.type === BIP43PurposeTypeEnum.Airbitz) {
      return xprivNode
        .derivePath('m/0/0')
        .derive(args.addressIndex)
    } else {
      return xprivNode
        .derive(args.changeIndex)
        .derive(args.addressIndex)
    }
  }
}

export function xpubToPubkey(args: XPubToPubkeyArgs): string {
  const node = bip32NodeFromPurposeType({ ...args, key: args.xpub })
  if (typeof node.publicKey === 'undefined') {
    throw new Error('Failed to generate public key from xpub')
  }
  return node.publicKey.toString('hex')
}

export function xprivToPrivateKey(args: XPrivToPrivateKeyArgs): string {
  const node = bip32NodeFromPurposeType({ ...args, key: args.xpriv })
  if (typeof node.privateKey === 'undefined') {
    throw new Error('Failed to generate private key from xpriv')
  }
  return node.privateKey.toString('hex')
}

export function addressToFormat(args: AddressToFormatArgs): string {
  const { type, format } = addressToAddressType(args)
  if (args.coin === 'bitcoin' || format === args.format) {
    return args.address
  }

  const coinClass = getCoinFromString(args.coin)
  const network = bip32NetworkFromCoin(args.network, args.coin)
  const legacyNetwork: BitcoinJSNetwork = { ...network }
  if (network.legacyPubKeyHash)
    legacyNetwork.pubKeyHash = network.legacyPubKeyHash
  if (network.legacyScriptHash)
    legacyNetwork.scriptHash = network.legacyScriptHash

  const payment: bitcoin.Payment = {
    network: args.format === AddressFormatEnum.Legacy ? legacyNetwork : network,
    bs58DecodeFunc: coinClass.bs58DecodeFunc,
    bs58EncodeFunc: coinClass.bs58EncodeFunc,
  }

  let convertedPayment: bitcoin.Payment | undefined

  if (args.coin === 'bitcoincash') {
    if (format === AddressFormatEnum.New) {
      args.address = hashToCashAddress(
        cashAddressToHash(args.address).scriptHash.toString('hex'),
        type === AddressTypeEnum.cashaddrP2PKH ? CashaddrTypeEnum.pubkeyhash : CashaddrTypeEnum.scripthash,
        args.network === NetworkEnum.Mainnet ? CashaddrPrefixEnum.mainnet : CashaddrPrefixEnum.testnet
      )
      payment.hash = cashAddressToHash(args.address).scriptHash
      convertedPayment = type === AddressTypeEnum.cashaddrP2PKH
        ? bitcoin.payments.p2pkh(payment)
        : bitcoin.payments.p2sh(payment)
      if (convertedPayment.address!.startsWith(args.coin)) {
        convertedPayment.address = convertedPayment.address!.split(':')[1]
      }
    } else {
      args.address = hashToCashAddress(
        bitcoin.address.fromBase58Check(args.address, coinClass.bs58DecodeFunc).hash.toString('hex'),
        type === AddressTypeEnum.cashaddrP2PKH ? CashaddrTypeEnum.pubkeyhash : CashaddrTypeEnum.scripthash,
        args.network === NetworkEnum.Mainnet ? CashaddrPrefixEnum.mainnet : CashaddrPrefixEnum.testnet
      )
      return args.address.split(':')[1]
    }
  } else {
    try {
      switch (type) {
        case AddressTypeEnum.p2pkh:
          payment.hash = bitcoin.address.fromBase58Check(args.address, coinClass.bs58DecodeFunc).hash
          convertedPayment = bitcoin.payments.p2pkh(payment)
          break
        case AddressTypeEnum.p2sh:
          if (format === AddressFormatEnum.New) {
            payment.output = bitcoin.address.toOutputScript(args.address, network, coinClass.bs58DecodeFunc)
          } else {
            payment.hash = bitcoin.address.fromBase58Check(args.address, coinClass.bs58DecodeFunc).hash
          }
          convertedPayment = bitcoin.payments.p2sh(payment)
          break
        case AddressTypeEnum.p2wsh:
          payment.output = bitcoin.payments.p2wsh({ address: args.address }).output
          convertedPayment = bitcoin.payments.p2wsh(payment)
          break
        case AddressTypeEnum.p2wpkh:
          payment.hash = bitcoin.address.fromBech32(args.address).data
          convertedPayment = bitcoin.payments.p2wpkh(payment)
          break
      }
    } catch (e) {}
  }

  return convertedPayment?.address ?? args.address
}

export function addressToScriptPubkey(args: AddressToScriptPubkeyArgs): string {
  const coinClass = getCoinFromString(args.coin)
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    args.network,
    args.coin
  )
  const legacyNetwork: BitcoinJSNetwork = {
    ...network,
    pubKeyHash: network.legacyPubKeyHash!,
    scriptHash: network.legacyScriptHash!
  }

  const { type } = addressToAddressType({
    address: args.address,
    network: args.network,
    coin: args.coin,
  })
  if (type === AddressTypeEnum.cashaddrP2PKH || type === AddressTypeEnum.cashaddrP2SH) {
    const result = cashAddressToHash(args.address)
    const prefix = args.network === NetworkEnum.Mainnet ? CashaddrPrefixEnum.mainnet: CashaddrPrefixEnum.testnet
    args.address = hashToCashAddress(result.scriptHash.toString('hex'), result.type, prefix)
  }

  let creator: bitcoin.payments.PaymentCreator
  switch (type) {
    case AddressTypeEnum.p2pkh:
    case AddressTypeEnum.cashaddrP2PKH:
      creator = bitcoin.payments.p2pkh
      break
    case AddressTypeEnum.p2sh:
    case AddressTypeEnum.p2wsh:
    case AddressTypeEnum.cashaddrP2SH:
      creator = bitcoin.payments.p2sh
      break
    case AddressTypeEnum.p2wpkh:
      creator = bitcoin.payments.p2wpkh
      break
  }

  let scriptPubkey: Buffer | undefined
  try {
    scriptPubkey = creator({
      address: args.address,
      network,
      bs58DecodeFunc: coinClass.bs58DecodeFunc,
      bs58EncodeFunc: coinClass.bs58EncodeFunc,
    }).output
  } catch (e) {
    try {
      scriptPubkey = bitcoin.address.toOutputScript(args.address, legacyNetwork, coinClass.bs58DecodeFunc)
    } catch (e) {
      scriptPubkey = bitcoin.address.toOutputScript(args.address, network, coinClass.bs58DecodeFunc)
    }
  }

  if (typeof scriptPubkey === 'undefined') {
    throw new Error('failed converting address to scriptPubkey')
  }
  return scriptPubkey.toString('hex')
}

export function scriptPubkeyToAddress(args: ScriptPubkeyToAddressArgs): string {
  let network: BitcoinJSNetwork
  try {
    const purpose = addressTypeToPurpose(args.addressType)
    network = bip32NetworkFromCoin(
      args.network,
      args.coin,
      purpose
    )
  } catch (e) {
    network = bip32NetworkFromCoin(
      args.network,
      args.coin,
    )
  }

  const prefix = args.network === NetworkEnum.Mainnet ? CashaddrPrefixEnum.mainnet: CashaddrPrefixEnum.testnet
  let address: string | undefined
  switch (args.addressType) {
    case AddressTypeEnum.cashaddrP2PKH:
      address = hashToCashAddress(args.scriptPubkey, CashaddrTypeEnum.pubkeyhash, prefix)
      break
    case AddressTypeEnum.cashaddrP2SH:
      address = hashToCashAddress(args.scriptPubkey, CashaddrTypeEnum.scripthash, prefix)
      break
    default:
      address = bitcoin.address.fromOutputScript(Buffer.from(args.scriptPubkey, 'hex'), network)
  }

  if (typeof address === 'undefined') {
    throw new Error('failed converting scriptPubkey to address')
  }
  return address
}

interface PaymentToPaymentArgs {
  scriptType: ScriptTypeEnum
  payment: bitcoin.Payment
}

export function scriptPaymentToPayment(args: PaymentToPaymentArgs): bitcoin.Payment {
  switch (args.scriptType) {
    case ScriptTypeEnum.p2pkh:
      return bitcoin.payments.p2pkh(args.payment)
    case ScriptTypeEnum.p2sh:
      return bitcoin.payments.p2sh(args.payment)
    case ScriptTypeEnum.p2wsh:
      return bitcoin.payments.p2wsh(args.payment)
    case ScriptTypeEnum.p2wpkhp2sh:
      try {
        return bitcoin.payments.p2sh({
          redeem: scriptPaymentToPayment({
            scriptType: ScriptTypeEnum.p2wpkh,
            payment: args.payment
          })
        })
      } catch {
        return bitcoin.payments.p2sh({
          redeem: scriptPaymentToPayment({
            scriptType: ScriptTypeEnum.p2wsh,
            payment: args.payment
          })
        })
      }
    case ScriptTypeEnum.p2wpkh:
      return bitcoin.payments.p2wpkh(args.payment)
    default:
      throw new Error('invalid script type in payment to payment')
  }
}

export function scriptHashToScriptPubkey(args: ScriptHashToScriptPubkeyArgs): string {
  const payment = scriptPaymentToPayment({
    scriptType: args.scriptType,
    payment: {
      hash: Buffer.from(args.scriptHash, 'hex'),
      network: bip32NetworkFromCoin(args.network, args.coin)
    }
  })
  if (typeof payment.output === 'undefined') {
    throw new Error('failed converting script hash to script pubkey')
  }
  return payment.output.toString('hex')
}

export function scriptPubkeyToScriptHash(
  args: ScriptPubkeyToScriptHashArgs
): string {
  const payment = scriptPaymentToPayment({
    scriptType: args.scriptType,
    payment: {
      output: Buffer.from(args.scriptPubkey, 'hex'),
      network: bip32NetworkFromCoin(args.network, args.coin)
    }
  })
  if (typeof payment.hash === 'undefined') {
    throw new Error('failed converting script pubkey to script hash')
  }
  return payment.hash.toString('hex')
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
  let payment: bitcoin.Payment
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

export function privateKeyToWIF(args: PrivateKeyToWIFArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    args.network,
    args.coin,
    BIP43PurposeTypeEnum.Legacy,
    true
  )
  const coinClass = getCoinFromString(args.coin)
  return bitcoin.ECPair.fromPrivateKey(Buffer.from(args.privateKey, 'hex'), {
    network,
  }).toWIF(coinClass.wifEncodeFunc)
}

export function wifToPrivateKey(args: WIFToPrivateKeyArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    args.network,
    args.coin,
    BIP43PurposeTypeEnum.Legacy,
    true
  )
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
    if (!utxo.script) continue
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

      if (utxo.redeemScript) {
        input.redeemScript = Buffer.from(utxo.redeemScript, 'hex')
      }
    }
    mappedUtxos.push(input)
  }

  const targets: utxopicker.Target[] = args.targets.map((target) => {
    const script = addressToScriptPubkey({
      address: target.address,
      coin: coin.name,
      network: args.network
    })
    const scriptType = scriptPubkeyToType(script)
    return {
      script,
      scriptType,
      value: target.value
    }
  })
  const changeScript = addressToScriptPubkey({
    address: args.freshChangeAddress,
    coin: coin.name,
    network: args.network
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
