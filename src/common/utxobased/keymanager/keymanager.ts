/* eslint-disable camelcase */
import * as bip32 from 'bip32'
import * as bip32grs from 'bip32grs'
import * as bip39 from 'bip39'
import * as bitcoin from 'altcoin-js'

import {
  cashAddressToHash,
  CashaddrPrefixEnum,
  CashaddrTypeEnum,
  hashToCashAddress,
} from './bitcoincashUtils/cashAddress'
import { cdsScriptTemplates } from './bitcoincashUtils/checkdatasig'
import { Coin, CoinPrefixes } from './coin'
import { getCoinFromString } from './coinmapper'

// this enumerates the network types of single coins. Can be expanded to add regtest, signet, stagenet etc.
export enum NetworkEnum {
  Mainnet = 'mainnet',
  Testnet = 'testnet',
}

// in bitcoin these are bip44, bip49, bip84 xpub prefixes
// other coins contain different formats which still need to be gathered.
export enum BIP43PurposeTypeEnum {
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
  cashaddrP2PKH = 'cashaddrP2PKH',
  cashaddrP2SH = 'cashaddrP2SH',
}

export enum ScriptTypeEnum {
  p2wpkh = 'p2wpkh',
  p2wpkhp2sh = 'p2wpkhp2sh',
  p2wsh = 'p2wsh',
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

export interface MnemonicToXPrivArgs {
  mnemonic: string
  path: string
  network: NetworkEnum
  type: BIP43PurposeTypeEnum
  coin: string
}

export interface LegacySeedToPrivateKeyArgs {
  seed: string
  index: number
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
  bip44ChangeIndex: 0 | 1
  bip44AddressIndex: number
  coin: string
}

export interface XPubToPubkeyArgs {
  xpub: string
  network: NetworkEnum
  type: BIP43PurposeTypeEnum
  bip44ChangeIndex: 0 | 1
  bip44AddressIndex: number
  coin: string
}

export interface AddressToScriptPubkeyArgs {
  address: string
  network: NetworkEnum
  addressType?: AddressTypeEnum
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

function addressTypeFromAddress(
  address: string,
  network: BitcoinJSNetwork,
  coin: string,
  addressType?: AddressTypeEnum
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
      return AddressTypeEnum.cashaddrP2PKH
    }
    return AddressTypeEnum.cashaddrP2SH
  } catch (e) {}

  throw new Error('Could not determine address type of ' + address)
}

function isPaymentFactory(payment: bitcoin.PaymentCreator): (script: Buffer) => boolean {
  return (script: Buffer): boolean => {
    try {
      payment({ output: script });
      return true;
    } catch (err) {
      return false;
    }
  };
}
const isP2MS = isPaymentFactory(bitcoin.payments.p2ms);
const isP2PK = isPaymentFactory(bitcoin.payments.p2pk);
const isP2PKH = isPaymentFactory(bitcoin.payments.p2pkh);
const isP2SH = isPaymentFactory(bitcoin.payments.p2sh);
const isP2WPKH = isPaymentFactory(bitcoin.payments.p2wpkh);
const isP2WSHScript = isPaymentFactory(bitcoin.payments.p2wsh);

export function scriptPubkeyToType(scriptPubkey: string): ScriptTypeEnum {
  const script = Buffer.from(scriptPubkey, 'hex')
  if (isP2PK(script)) {
    return ScriptTypeEnum.p2pkh
  }
  if (isP2PKH(script)) {
    return ScriptTypeEnum.p2pkh
  }
  if (isP2SH(script)) {
    return ScriptTypeEnum.p2sh
  }
  if (isP2WSHScript(script)) {
    return ScriptTypeEnum.p2wpkhp2sh
  }
  if (isP2WPKH(script)) {
    return ScriptTypeEnum.p2wpkh
  }

  throw new Error('Could not determine scriptPubkey type of ' + scriptPubkey)
}

export function addressTypeToPurpose(type: AddressTypeEnum): BIP43PurposeTypeEnum {
  switch (type) {
    case AddressTypeEnum.p2pkh:
      return BIP43PurposeTypeEnum.Legacy

    case AddressTypeEnum.p2sh:
      return BIP43PurposeTypeEnum.WrappedSegwit

    case AddressTypeEnum.p2wpkh:
    case AddressTypeEnum.p2wsh:
      return BIP43PurposeTypeEnum.Segwit

    default:
      throw new Error('Invalid address type')
  }
}

export function legacySeedToXPriv(seed: string): string {
  const xpriv = bip32
    .fromSeed(Buffer.from(seed, 'hex'))
    .derivePath('m/0')
    .toBase58()
  if (typeof xpriv === 'undefined') {
    throw new Error('Failed to generate xpriv from legacy seed')
  }
  return xpriv
}

export function legacySeedToPrivateKey(
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

export function xpubToPubkey(args: XPubToPubkeyArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    args.network,
    args.coin,
    args.type
  )
  if (args.coin === 'groestlcoin') {
    const node: bip32.BIP32Interface = bip32grs.fromBase58(args.xpub, network)
    return node
      .derive(args.bip44ChangeIndex)
      .derive(args.bip44AddressIndex)
      .publicKey.toString('hex')
  }
  const node: bip32.BIP32Interface = bip32.fromBase58(args.xpub, network)
  return node
    .derive(args.bip44ChangeIndex)
    .derive(args.bip44AddressIndex)
    .publicKey.toString('hex')
}

export function addressToScriptPubkey(args: AddressToScriptPubkeyArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    args.network,
    args.coin
  )
  const addressType: AddressTypeEnum = addressTypeFromAddress(
    args.address,
    network,
    args.coin,
    args.addressType
  )
  const coinClass = getCoinFromString(args.coin)
  let payment: bitcoin.payments.PaymentCreator
  switch (addressType) {
    case AddressTypeEnum.p2pkh:
      payment = bitcoin.payments.p2pkh
      break
    case AddressTypeEnum.p2sh:
      payment = bitcoin.payments.p2sh
      break
    case AddressTypeEnum.p2wpkh:
      payment = bitcoin.payments.p2wpkh
      break
    case AddressTypeEnum.p2wsh:
      payment = bitcoin.payments.p2wsh
      break
    case AddressTypeEnum.cashaddrP2PKH:
      return scriptHashToScriptPubkey({
        scriptHash: cashAddressToHash(args.address).scriptHash.toString('hex'),
        network: args.network,
        scriptType: ScriptTypeEnum.p2pkh,
        coin: args.coin,
      })
    case AddressTypeEnum.cashaddrP2SH:
      return scriptHashToScriptPubkey({
        scriptHash: cashAddressToHash(args.address).scriptHash.toString('hex'),
        network: args.network,
        scriptType: ScriptTypeEnum.p2sh,
        coin: args.coin,
      })
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

export function scriptPubkeyToAddress(args: ScriptPubkeyToAddressArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    args.network,
    args.coin
  )
  const coinClass = getCoinFromString(args.coin)
  let payment: bitcoin.payments.PaymentCreator
  switch (args.addressType) {
    case AddressTypeEnum.p2pkh:
      payment = bitcoin.payments.p2pkh
      break
    case AddressTypeEnum.p2sh:
      payment = bitcoin.payments.p2sh
      break
    case AddressTypeEnum.p2wpkh:
      payment = bitcoin.payments.p2wpkh
      break
    case AddressTypeEnum.p2wsh:
      payment = bitcoin.payments.p2wsh
      break
    case AddressTypeEnum.cashaddrP2PKH:
      if (args.network === NetworkEnum.Testnet) {
        return hashToCashAddress(
          scriptPubkeyToScriptHash({
            scriptPubkey: args.scriptPubkey,
            network: args.network,
            scriptType: ScriptTypeEnum.p2pkh,
            coin: args.coin,
          }),
          CashaddrTypeEnum.pubkeyhash,
          CashaddrPrefixEnum.testnet
        )
      }
      return hashToCashAddress(
        scriptPubkeyToScriptHash({
          scriptPubkey: args.scriptPubkey,
          network: args.network,
          scriptType: ScriptTypeEnum.p2pkh,
          coin: args.coin,
        }),
        CashaddrTypeEnum.pubkeyhash,
        CashaddrPrefixEnum.mainnet
      )
    case AddressTypeEnum.cashaddrP2SH:
      if (args.network === NetworkEnum.Testnet) {
        return hashToCashAddress(
          scriptPubkeyToScriptHash({
            scriptPubkey: args.scriptPubkey,
            network: args.network,
            scriptType: ScriptTypeEnum.p2sh,
            coin: args.coin,
          }),
          CashaddrTypeEnum.scripthash,
          CashaddrPrefixEnum.testnet
        )
      }
      return hashToCashAddress(
        scriptPubkeyToScriptHash({
          scriptPubkey: args.scriptPubkey,
          network: args.network,
          scriptType: ScriptTypeEnum.p2sh,
          coin: args.coin,
        }),
        CashaddrTypeEnum.scripthash,
        CashaddrPrefixEnum.mainnet
      )
    default:
      throw new Error('invalid address type in address to script pubkey')
  }
  const address = payment({
    output: Buffer.from(args.scriptPubkey, 'hex'),
    network: network,
    bs58DecodeFunc: coinClass.bs58DecodeFunc,
    bs58EncodeFunc: coinClass.bs58EncodeFunc,
  }).address

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

export function xprivToPrivateKey(args: XPrivToPrivateKeyArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    args.network,
    args.coin,
    args.type
  )
  if (args.coin === 'groestlcoin') {
    const node: bip32.BIP32Interface = bip32grs.fromBase58(args.xpriv, network)
    const privateKey = node.derive(args.bip44ChangeIndex).derive(args.bip44AddressIndex).privateKey
    if (typeof privateKey === 'undefined') {
      throw new Error('Failed to generate private key from xpriv')
    }
    return privateKey.toString('hex')
  }
  const node: bip32.BIP32Interface = bip32.fromBase58(args.xpriv, network)
  const privateKey = node.derive(args.bip44ChangeIndex).derive(args.bip44AddressIndex).privateKey
  if (typeof privateKey === 'undefined') {
    throw new Error('Failed to generate private key from xpriv')
  }
  return privateKey.toString('hex')
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

export function signTx(args: SignTxArgs): string {
  const psbt = bitcoin.Psbt.fromBase64(args.psbt)
  const coin = getCoinFromString(args.coin)
  for (let i: number = 0; i < args.privateKeys.length; i++) {
    if (typeof coin.sighashFunction !== 'undefined') {
      psbt.signInput(
        i,
        bitcoin.ECPair.fromPrivateKey(Buffer.from(args.privateKeys[i], 'hex')),
        bitcoin.Psbt.DEFAULT_SIGHASHES,
        coin.sighashFunction
      )
    } else {
      psbt.signInput(
        i,
        bitcoin.ECPair.fromPrivateKey(Buffer.from(args.privateKeys[i], 'hex'))
      )
    }
    psbt.validateSignaturesOfInput(i)
  }
  psbt.finalizeAllInputs()
  return psbt.extractTransaction().toHex()
}
