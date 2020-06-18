import * as bip32 from 'bip32'
import { BIP32Interface } from 'bip32'
import * as bip39 from 'bip39'
import * as bitcoin from 'bitcoinjs-lib'

// this enumerates the network types of single coins. Can be expanded to add regtest, signet, stagenet etc.
export enum NetworkEnum {
  Mainnet,
  Testnet
}

// in bitcoin these are bip44, bip49, bip84 xpub prefixes
// other coins contain different formats which still need to be gathered.
export enum BIP43PurposeTypeEnum {
  Legacy, // xpub/xprv tpub/tprv
  Segwit, // zpub/zprv vpub/vprv
  WrappedSegwit // ypub/yprv upub/uprv
}

// supported address types.
export enum AddressTypeEnum {
  p2pkh,
  p2sh,
  p2wpkhp2sh,
  p2wpkh,
  p2wsh, // TODO: both witness script hash variants have not been implemented so far.
  p2wshp2sh,
  cashaddr
}

export interface MnemonicToXPrivArgs {
  mnemonic: string
  path: string
  network: NetworkEnum
  type: BIP43PurposeTypeEnum
  coin: Coin
}

export interface XPrivToXPubArgs {
  xpriv: string
  network: NetworkEnum
  type: BIP43PurposeTypeEnum
  coin: Coin
}

export interface XPrivToPrivateKeyArgs {
  xpriv: string
  network: NetworkEnum
  type: BIP43PurposeTypeEnum
  bip44ChangeIndex: 0 | 1
  bip44AddressIndex: number
  coin: Coin
}

// Careful! Calling this the ScriptHash is only correct for p2sh addresses.
// For p2pkh and p2wpkh this is just the pubkey hash.
export interface XPubToScriptHashArgs {
  xpub: string
  network: NetworkEnum
  type: BIP43PurposeTypeEnum
  addressType: AddressTypeEnum
  bip44ChangeIndex: 0 | 1
  bip44AddressIndex: number
  coin: Coin
}

// Careful! Calling this the ScriptHash is only correct for p2sh addresses.
// For p2pkh and p2wpkh this is just the pubkey hash.
export interface ScriptHashToAddressArgs {
  scriptHash: Buffer | undefined
  network: NetworkEnum
  addressType: AddressTypeEnum
  coin: Coin
}

// Careful! Calling this the ScriptHash is only correct for p2sh addresses.
// For p2pkh and p2wpkh this is just the pubkey hash.
export interface AddressToScriptHashArgs {
  address: string
  network: NetworkEnum
  addressType: AddressTypeEnum
  coin: Coin
}

export interface AddressToScriptPubkeyArgs {
  address: string
  network: NetworkEnum
  addressType: AddressTypeEnum
  coin: Coin
}

export interface PubkeyToScriptPubkeyArgs {
  pubkey: Buffer
  addressType: AddressTypeEnum
}

export interface WIFToPrivateKeyArgs {
  wifKey: string
  network: NetworkEnum
  coin: Coin
}

export interface PrivateKeyToWIFArgs {
  privateKey: Buffer
  network: NetworkEnum
  coin: Coin
}

// A transaction input is either legacy or segwit. This is used for transaction creation and passed per input
export enum TransactionInputTypeEnum {
  Legacy,
  Segwit
}

export interface TxInput {
  type: TransactionInputTypeEnum
  prev_txid: string
  index: number
  prev_txout: Buffer // relevant for legacy transactions
  prev_scriptPubkey: Buffer // relevant for segwit transactions, maybe make it optional in the future
}

export interface TxOutput {
  scriptPubkey: Buffer
  amount: number
}

export interface CreateTxArgs {
  network: NetworkEnum
  inputs: TxInput[]
  outputs: TxOutput[]
  privateKey: Buffer
  rbf: boolean
}

export interface CoinPrefixes {
  MessagePrefix: string
  WIF: number
  LegacyXPriv: number
  LegacyXPub: number
  WrappedSegwitXPriv?: number
  WrappedSegwitXPub?: number
  SegwitXPriv?: number
  SegwitXPub?: number
  PubkeyHash: number
  ScriptHash: number
  Bech32?: string
  CashAddr?: string
}

export interface Coin {
  Name: string
  MainnetConstants: CoinPrefixes
  TestnetConstants: CoinPrefixes
}

// this an example implementation of a Coin class to show all required constants
// not that support for esoteric sighash types is omitted for now
export class Bitcoin implements Coin {
  Name: string = 'bitcoin'

  MainnetConstants = {
    MessagePrefix: '\x18Bitcoin Signed Message:\n',
    WIF: 0x80,
    LegacyXPriv: 0x0488ade4,
    LegacyXPub: 0x0488b21e,
    WrappedSegwitXPriv: 0x049d7878,
    WrappedSegwitXPub: 0x049d7cb2,
    SegwitXPriv: 0x04b2430c,
    SegwitXPub: 0x04b24746,
    PubkeyHash: 0x00,
    ScriptHash: 0x05,
    Bech32: 'bc'
  }

  TestnetConstants = {
    MessagePrefix: '\x18Bitcoin Signed Message:\n',
    WIF: 0xef,
    LegacyXPriv: 0x04358394,
    LegacyXPub: 0x043587cf,
    WrappedSegwitXPriv: 0x044a4e28,
    WrappedSegwitXPub: 0x044a5262,
    SegwitXPriv: 0x045f18bc,
    SegwitXPub: 0x045f1cf6,
    PubkeyHash: 0x6f,
    ScriptHash: 0xc4,
    Bech32: 'tb'
  }
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
  coinPrefixes: CoinPrefixes
): BitcoinJSNetwork {
  let xKeyPrefixes: Bip32
  switch (sigType) {
    case BIP43PurposeTypeEnum.Segwit:
      xKeyPrefixes = {
        public: coinPrefixes.SegwitXPub,
        private: coinPrefixes.SegwitXPriv
      }
      break
    case BIP43PurposeTypeEnum.WrappedSegwit:
      xKeyPrefixes = {
        public: coinPrefixes.WrappedSegwitXPub,
        private: coinPrefixes.WrappedSegwitXPriv
      }
      break
    case BIP43PurposeTypeEnum.Legacy:
      xKeyPrefixes = {
        public: coinPrefixes.LegacyXPub,
        private: coinPrefixes.LegacyXPriv
      }
      break
  }
  return {
    messagePrefix: coinPrefixes.MessagePrefix,
    wif: coinPrefixes.WIF,
    bip32: xKeyPrefixes,
    bech32: coinPrefixes.Bech32,
    pubKeyHash: coinPrefixes.PubkeyHash,
    scriptHash: coinPrefixes.ScriptHash
  }
}

function bip32NetworkFromCoin(
  networkType: NetworkEnum,
  coin: Coin,
  sigType: BIP43PurposeTypeEnum = BIP43PurposeTypeEnum.Legacy
): BitcoinJSNetwork {
  if (networkType === NetworkEnum.Testnet) {
    return bip32NetworkFromCoinPrefix(sigType, coin.TestnetConstants)
  }
  return bip32NetworkFromCoinPrefix(sigType, coin.MainnetConstants)
}

export function mnemonicToXPriv(
  mnemonicToXPrivArgs: MnemonicToXPrivArgs
): string {
  const seed = bip39.mnemonicToSeedSync(mnemonicToXPrivArgs.mnemonic)
  const root: BIP32Interface = bip32.fromSeed(seed)
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    mnemonicToXPrivArgs.network,
    mnemonicToXPrivArgs.coin,
    mnemonicToXPrivArgs.type
  )
  root.network = network
  const child: BIP32Interface = root.derivePath(mnemonicToXPrivArgs.path)
  return child.toBase58()
}

export function xprivToXPub(xprivToXPubArgs: XPrivToXPubArgs): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    xprivToXPubArgs.network,
    xprivToXPubArgs.coin,
    xprivToXPubArgs.type
  )
  const node: BIP32Interface = bip32.fromBase58(xprivToXPubArgs.xpriv, network)
  return node.neutered().toBase58()
}

// return pubkey hash / script hash based on chosen type and network
export function xpubToScriptHash(
  xpubToScriptHashArgs: XPubToScriptHashArgs
): Buffer | undefined {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    xpubToScriptHashArgs.network,
    xpubToScriptHashArgs.coin,
    xpubToScriptHashArgs.type
  )
  const node: BIP32Interface = bip32.fromBase58(
    xpubToScriptHashArgs.xpub,
    network
  )
  const pubkey: Buffer = node
    .derive(xpubToScriptHashArgs.bip44ChangeIndex)
    .derive(xpubToScriptHashArgs.bip44AddressIndex).publicKey
  switch (xpubToScriptHashArgs.addressType) {
    case AddressTypeEnum.p2pkh:
      return bitcoin.payments.p2pkh({ pubkey, network }).hash
    case AddressTypeEnum.p2sh:
      return bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2pkh({ pubkey, network })
      }).hash
    case AddressTypeEnum.p2wpkhp2sh:
      return bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({ pubkey, network })
      }).hash
    case AddressTypeEnum.p2wpkh:
      return bitcoin.payments.p2wpkh({ pubkey, network }).hash
  }
}

// take passed in script hash (for p2sh)/ pubkey hash (for p2pkh and p2wpkh) and encode as address of choice
export function scriptHashToAddress(
  scriptHashToAddressArgs: ScriptHashToAddressArgs
): string | undefined {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    scriptHashToAddressArgs.network,
    scriptHashToAddressArgs.coin
  )
  switch (scriptHashToAddressArgs.addressType) {
    case AddressTypeEnum.p2pkh:
      return bitcoin.payments.p2pkh({
        hash: scriptHashToAddressArgs.scriptHash,
        network: network
      }).address
    case AddressTypeEnum.p2sh:
    case AddressTypeEnum.p2wpkhp2sh:
      return bitcoin.payments.p2sh({
        hash: scriptHashToAddressArgs.scriptHash,
        network: network
      }).address
    case AddressTypeEnum.p2wpkh:
      return bitcoin.payments.p2wpkh({
        hash: scriptHashToAddressArgs.scriptHash,
        network: network
      }).address
  }
}

// take an address and return either a script hash (for a p2sh address) or a pubkey hash (for p2pkh and p2wpkh)
export function addressToScriptHash(
  addressToScriptHashArgs: AddressToScriptHashArgs
): Buffer | undefined {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    addressToScriptHashArgs.network,
    addressToScriptHashArgs.coin
  )
  switch (addressToScriptHashArgs.addressType) {
    case AddressTypeEnum.p2pkh:
      return bitcoin.payments.p2pkh({
        address: addressToScriptHashArgs.address,
        network: network
      }).hash
    case AddressTypeEnum.p2sh:
    case AddressTypeEnum.p2wpkhp2sh:
      return bitcoin.payments.p2sh({
        address: addressToScriptHashArgs.address,
        network: network
      }).hash
    case AddressTypeEnum.p2wpkh:
      return bitcoin.payments.p2wpkh({
        address: addressToScriptHashArgs.address,
        network: network
      }).hash
    case AddressTypeEnum.p2wsh:
      return bitcoin.payments.p2wsh({
        address: addressToScriptHashArgs.address,
        network: network
      }).hash
  }
}

export function addressToScriptPubkey(
  addressToScriptPubkeyArgs: AddressToScriptPubkeyArgs
): Buffer | undefined {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    addressToScriptPubkeyArgs.network,
    addressToScriptPubkeyArgs.coin
  )
  switch (addressToScriptPubkeyArgs.addressType) {
    case AddressTypeEnum.p2pkh:
      return bitcoin.payments.p2pkh({
        address: addressToScriptPubkeyArgs.address,
        network: network
      }).output
    case AddressTypeEnum.p2sh:
    case AddressTypeEnum.p2wpkhp2sh:
      return bitcoin.payments.p2sh({
        address: addressToScriptPubkeyArgs.address,
        network: network
      }).output
    case AddressTypeEnum.p2wpkh:
      return bitcoin.payments.p2wpkh({
        address: addressToScriptPubkeyArgs.address,
        network: network
      }).output
  }
}

export function pubkeyToScriptPubkey(
  pubkeyToScriptPubkeyArgs: PubkeyToScriptPubkeyArgs
): Buffer | undefined {
  switch (pubkeyToScriptPubkeyArgs.addressType) {
    case AddressTypeEnum.p2pkh:
      return bitcoin.payments.p2pkh({ pubkey: pubkeyToScriptPubkeyArgs.pubkey })
        .output
    case AddressTypeEnum.p2sh:
    case AddressTypeEnum.p2wpkhp2sh:
      return bitcoin.payments.p2sh({ pubkey: pubkeyToScriptPubkeyArgs.pubkey })
        .output
    case AddressTypeEnum.p2wpkh:
      return bitcoin.payments.p2wpkh({
        pubkey: pubkeyToScriptPubkeyArgs.pubkey
      }).output
  }
}

export function xprivToPrivateKey(
  xprivToPrivateKeyArgs: XPrivToPrivateKeyArgs
): Buffer | undefined {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    xprivToPrivateKeyArgs.network,
    xprivToPrivateKeyArgs.coin,
    xprivToPrivateKeyArgs.type
  )
  const node: BIP32Interface = bip32.fromBase58(
    xprivToPrivateKeyArgs.xpriv,
    network
  )
  console.log()
  return node.derive(0).derive(0).privateKey
}

export function PrivateKeyToWIF(
  privateKeyToWIFArgs: PrivateKeyToWIFArgs
): string {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    privateKeyToWIFArgs.network,
    privateKeyToWIFArgs.coin
  )
  const ecPair: bitcoin.ECPairInterface = bitcoin.ECPair.fromPrivateKey(
    privateKeyToWIFArgs.privateKey,
    { network }
  )
  return ecPair.toWIF()
}

export function wifToPrivateKey(
  wifToECPairArgs: WIFToPrivateKeyArgs
): Buffer | undefined {
  const network: BitcoinJSNetwork = bip32NetworkFromCoin(
    wifToECPairArgs.network,
    wifToECPairArgs.coin
  )
  return bitcoin.ECPair.fromWIF(wifToECPairArgs.wifKey, network).privateKey
}

export function privateKeyToPubkey(privateKey: Buffer): Buffer {
  return bitcoin.ECPair.fromPrivateKey(privateKey).publicKey
}

export function createTx(createTxArgs: CreateTxArgs): string {
  const psbt = new bitcoin.Psbt()
  let sequence: number = 0xffffffff
  if (createTxArgs.rbf) {
    sequence -= 2
  }
  for (let i: number = 0; i < createTxArgs.inputs.length; i++) {
    if (createTxArgs.inputs[i].type === TransactionInputTypeEnum.Legacy) {
      psbt.addInput({
        hash: createTxArgs.inputs[i].prev_txid,
        index: 0,
        sequence: sequence,
        // non-segwit inputs now require passing the whole previous tx as Buffer
        nonWitnessUtxo: createTxArgs.inputs[i].prev_txout
      })
    } else {
      psbt.addInput({
        hash: createTxArgs.inputs[i].prev_txid,
        index: 0,
        sequence: sequence,
        // add witnessUtxo for Segwit input type. The scriptPubkey and the value only are needed.
        witnessUtxo: {
          script: createTxArgs.inputs[i].prev_scriptPubkey,
          value: 90000
        }
      })
    }
  }
  for (let i: number = 0; i < createTxArgs.outputs.length; i++) {
    psbt.addOutput({
      script: createTxArgs.outputs[i].scriptPubkey,
      value: 80000
    })
  }
  const ecPair = bitcoin.ECPair.fromPrivateKey(createTxArgs.privateKey)
  psbt.signInput(0, ecPair)
  psbt.validateSignaturesOfInput(0)
  psbt.finalizeAllInputs()
  return psbt.extractTransaction().toHex()
}
