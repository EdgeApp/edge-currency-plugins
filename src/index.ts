import * as bip32 from 'bip32'
import { BIP32Interface } from 'bip32'
import * as bip39 from 'bip39'
import * as bitcoin from 'bitcoinjs-lib'

export enum NetworkEnum {
  Mainnet,
  Testnet
}

// bip32, bip49, bip84 xpub prefixes
export enum BIP43PurposeTypeEnum {
  Legacy, // xpub/xprv tpub/tprv
  Segwit, // zpub/zprv vpub/vprv
  WrappedSegwit // ypub/yprv upub/uprv
}

// supported address types. Notice that p2wsh is not included.
export enum AddressTypeEnum {
  p2pkh,
  p2sh,
  p2wpkhp2sh,
  p2wpkh,
  p2wsh, // TODO: both witness script hash variants have not been implemented so far.
  p2wshp2sh
}

export enum TransactionInputTypeEnum {
  Legacy,
  Segwit
}

export interface MnemonicToXPrivArgs {
  mnemonic: string
  path: string
  network: NetworkEnum
  type: BIP43PurposeTypeEnum
}

export interface XPrivToXPubArgs {
  xpriv: string
  network: NetworkEnum
  type: BIP43PurposeTypeEnum
}

export interface XPrivToPrivateKeyArgs {
  xpriv: string
  network: NetworkEnum
  type: BIP43PurposeTypeEnum
  bip44ChangeIndex: 0 | 1
  bip44AddressIndex: number
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
}

export interface ScriptHashToAddressArgs {
  scriptHash: Buffer | undefined
  network: NetworkEnum
  addressType: AddressTypeEnum
}

export interface AddressToScriptHashArgs {
  address: string
  network: NetworkEnum
  addressType: AddressTypeEnum
}

export interface AddressToScriptPubkeyArgs {
  address: string
  network: NetworkEnum
  addressType: AddressTypeEnum
}

export interface PubkeyToScriptPubkeyArgs {
  pubkey: Buffer
  addressType: AddressTypeEnum
}

export interface WIFToECPairArgs {
  wifKey: string
  network?: NetworkEnum
}

export type ECPair = bitcoin.ECPairInterface

export interface TxInput {
  type: TransactionInputTypeEnum
  prev_txid: string
  index: number
  prev_txout: Buffer // relevant for legacy transactions
  prev_scriptPubkey: Buffer // relevant for segwit transactions, maybe make it optional in the future
  sequence: number
}

export interface TxOutput {
  scriptPubkey: Buffer
  amount: number
}

export interface CreateTxArgs {
  network: NetworkEnum
  inputs: TxInput[]
  outputs: TxOutput[]
  locktime: number
  privateKey: ECPair
}

interface BIP32Network {
  wif: number
  bip32: {
    public: number
    private: number
  }
  messagePrefix?: string
  bech32?: string
  pubKeyHash?: number
  scriptHash?: number
}

// helper function for the extended key prefix constant pairs
function getBIP32NetworkPrefixBytes(
  networkType: NetworkEnum,
  sigType: BIP43PurposeTypeEnum
): BIP32Network {
  switch (networkType) {
    case NetworkEnum.Testnet:
      switch (sigType) {
        case BIP43PurposeTypeEnum.Segwit:
          return {
            wif: 0xef,
            bip32: { public: 0x045f1cf6, private: 0x045f18bc }
          }
        case BIP43PurposeTypeEnum.WrappedSegwit:
          return {
            wif: 0xef,
            bip32: { public: 0x044a5262, private: 0x044a4e28 }
          }
        // always assume the basic "legacy" xpub type
        default:
          return {
            wif: 0xef,
            bip32: { public: 0x043587cf, private: 0x04358394 }
          }
      }
    // always assume mainnet
    default:
      switch (sigType) {
        case BIP43PurposeTypeEnum.Segwit:
          return {
            wif: 0x80,
            bip32: { public: 0x04b24746, private: 0x04b2430c }
          }
        case BIP43PurposeTypeEnum.WrappedSegwit:
          return {
            wif: 0x80,
            bip32: { public: 0x049d7cb2, private: 0x049d7878 }
          }
        // always assume the basic "legacy" xpub type
        default:
          return {
            wif: 0x80,
            bip32: { public: 0x0488b21e, private: 0x0488ade4 }
          }
      }
  }
}

export function mnemonicToXPriv(
  mnemonicToXPrivArgs: MnemonicToXPrivArgs
): string {
  const seed = bip39.mnemonicToSeedSync(mnemonicToXPrivArgs.mnemonic)
  const root: BIP32Interface = bip32.fromSeed(seed)
  const network: BIP32Network = getBIP32NetworkPrefixBytes(
    mnemonicToXPrivArgs.network,
    mnemonicToXPrivArgs.type
  )
  root.network = network
  const child: BIP32Interface = root.derivePath(mnemonicToXPrivArgs.path)
  return child.toBase58()
}

export function xprivToXPub(xprivToXPubArgs: XPrivToXPubArgs): string {
  const network: BIP32Network = getBIP32NetworkPrefixBytes(
    xprivToXPubArgs.network,
    xprivToXPubArgs.type
  )
  const node: BIP32Interface = bip32.fromBase58(xprivToXPubArgs.xpriv, network)
  return node.neutered().toBase58()
}

// return pubkey hash / script hash based on chosen type and network
export function xpubToScriptHash(
  xpubToScriptHashArgs: XPubToScriptHashArgs
): Buffer | undefined {
  const network: BIP32Network = getBIP32NetworkPrefixBytes(
    xpubToScriptHashArgs.network,
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
      return bitcoin.payments.p2pkh({ pubkey }).hash
    case AddressTypeEnum.p2sh:
      return bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2pkh({ pubkey })
      }).hash
    case AddressTypeEnum.p2wpkhp2sh:
      return bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({ pubkey })
      }).hash
    case AddressTypeEnum.p2wpkh:
      return bitcoin.payments.p2wpkh({ pubkey }).hash
  }
}

// take passed in script hash (for p2sh)/ pubkey hash (for p2pkh and p2wpkh) and encode as address of choice
export function scriptHashToAddress(
  scriptHashToAddressArgs: ScriptHashToAddressArgs
): string | undefined {
  switch (scriptHashToAddressArgs.addressType) {
    case AddressTypeEnum.p2pkh:
      return bitcoin.payments.p2pkh({
        hash: scriptHashToAddressArgs.scriptHash
      }).address
    case AddressTypeEnum.p2sh:
    case AddressTypeEnum.p2wpkhp2sh:
      return bitcoin.payments.p2sh({ hash: scriptHashToAddressArgs.scriptHash })
        .address
    case AddressTypeEnum.p2wpkh:
      return bitcoin.payments.p2wpkh({
        hash: scriptHashToAddressArgs.scriptHash
      }).address
  }
}

// take an address and return either a script hash (for a p2sh address) or a pubkey hash (for p2pkh and p2wpkh)
export function addressToScriptHash(
  addressToScriptHashArgs: AddressToScriptHashArgs
): Buffer | undefined {
  switch (addressToScriptHashArgs.addressType) {
    case AddressTypeEnum.p2pkh:
      return bitcoin.payments.p2pkh({
        address: addressToScriptHashArgs.address
      }).hash
    case AddressTypeEnum.p2sh:
    case AddressTypeEnum.p2wpkhp2sh:
      return bitcoin.payments.p2sh({ address: addressToScriptHashArgs.address })
        .hash
    case AddressTypeEnum.p2wpkh:
      return bitcoin.payments.p2wpkh({
        address: addressToScriptHashArgs.address
      }).hash
  }
}

export function addressToScriptPubkey(
  addressToScriptPubkeyArgs: AddressToScriptPubkeyArgs
): Buffer | undefined {
  switch (addressToScriptPubkeyArgs.addressType) {
    case AddressTypeEnum.p2pkh:
      return bitcoin.payments.p2pkh({
        address: addressToScriptPubkeyArgs.address
      }).output
    case AddressTypeEnum.p2sh:
    case AddressTypeEnum.p2wpkhp2sh:
      return bitcoin.payments.p2sh({
        address: addressToScriptPubkeyArgs.address
      }).output
    case AddressTypeEnum.p2wpkh:
      return bitcoin.payments.p2wpkh({
        address: addressToScriptPubkeyArgs.address
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
  const network: BIP32Network = getBIP32NetworkPrefixBytes(
    xprivToPrivateKeyArgs.network,
    xprivToPrivateKeyArgs.type
  )
  const node: BIP32Interface = bip32.fromBase58(
    xprivToPrivateKeyArgs.xpriv,
    network
  )
  return node.derive(0).derive(0).privateKey
}

export function wifToECPair(wifToECPairArgs: WIFToECPairArgs): ECPair {
  // later we can pass in an extra network here
  return bitcoin.ECPair.fromWIF(
    'L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr'
  )
}

export function createTx(createTxArgs: CreateTxArgs): string {
  const alice = bitcoin.ECPair.fromWIF(
    'L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr'
  )
  const psbt = new bitcoin.Psbt()
  for (let i: number = 0; i < createTxArgs.inputs.length; i++) {
    if (createTxArgs.inputs[i].type === TransactionInputTypeEnum.Legacy) {
      psbt.addInput({
        hash: createTxArgs.inputs[i].prev_txid,
        index: 0,
        sequence: createTxArgs.inputs[i].sequence,
        // non-segwit inputs now require passing the whole previous tx as Buffer
        nonWitnessUtxo: createTxArgs.inputs[i].prev_txout
      })
    } else {
      psbt.addInput({
        hash: createTxArgs.inputs[i].prev_txid,
        index: 0,
        sequence: createTxArgs.inputs[i].sequence,
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
  psbt.signInput(0, alice)
  psbt.validateSignaturesOfInput(0)
  psbt.finalizeAllInputs()
  return psbt.extractTransaction().toHex()
}
