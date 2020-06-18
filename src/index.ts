import * as bip32 from 'bip32'
import { BIP32Interface } from 'bip32'
import * as bip39 from 'bip39'
import * as bitcoin from 'bitcoinjs-lib'

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

// supported address types. Notice that p2wsh is not included.
export enum AddressTypeEnum {
  p2pkh,
  p2sh,
  p2wpkhp2sh,
  p2wpkh,
  p2wsh, // TODO: both witness script hash variants have not been implemented so far.
  p2wshp2sh,
  cashaddr
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

export interface ScriptHashToAddressArgs {
  scriptHash: Buffer | undefined
  network: NetworkEnum
  addressType: AddressTypeEnum
  coin: Coin
}

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

export interface WIFToECPairArgs {
  wifKey: string
  network: NetworkEnum
  coin: Coin
}

export type ECPair = bitcoin.ECPairInterface

export interface TxInput {
  type: TransactionInputTypeEnum
  prev_txid: string
  index: number
  prev_txout: Buffer // relevant for legacy transactions
  prev_scriptPubkey: Buffer // relevant for segwit transactions, maybe make it optional in the future
  // sequence: number
}

export interface TxOutput {
  scriptPubkey: Buffer
  amount: number
}

export interface CreateTxArgs {
  network: NetworkEnum
  inputs: TxInput[]
  outputs: TxOutput[]
  privateKey: ECPair
  rbf: boolean
}

export interface CoinPrefixes {
  MessagePrefix: string
  WIF: number
  LegacyXPriv: number
  LegacyXPub: number
  WrappedSegwitXPriv: number
  WrappedSegwitXPub: number
  SegwitXPriv: number
  SegwitXPub: number
  PubkeyHash: number
  ScriptHash: number
  Bech32: string
}

export interface Coin {
  Name: string
  MainnetConstants: CoinPrefixes
  TestnetConstants: CoinPrefixes
}

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

interface BIP32Network {
  wif: number
  bip32: {
    public: number
    private: number
  }
  messagePrefix: string
  bech32: string
  pubKeyHash: number
  scriptHash: number
}

function bip32NetworkFromCoinPrefix(
  sigType: BIP43PurposeTypeEnum,
  coinPrefixes: CoinPrefixes
): BIP32Network {
  const network: BIP32Network = {
    messagePrefix: coinPrefixes.MessagePrefix,
    wif: coinPrefixes.WIF,
    bip32: {
      public: coinPrefixes.LegacyXPub,
      private: coinPrefixes.LegacyXPriv
    },
    bech32: coinPrefixes.Bech32,
    pubKeyHash: coinPrefixes.PubkeyHash,
    scriptHash: coinPrefixes.ScriptHash
  }
  switch (sigType) {
    case BIP43PurposeTypeEnum.Segwit:
      network.bip32 = {
        public: coinPrefixes.SegwitXPub,
        private: coinPrefixes.SegwitXPriv
      }
      break
    case BIP43PurposeTypeEnum.WrappedSegwit:
      network.bip32 = {
        public: coinPrefixes.WrappedSegwitXPub,
        private: coinPrefixes.WrappedSegwitXPriv
      }
      break
    case BIP43PurposeTypeEnum.Legacy:
      network.bip32 = {
        public: coinPrefixes.LegacyXPub,
        private: coinPrefixes.LegacyXPriv
      }
      break
    default:
      // TODO: Crash here
      break
  }
  return network
}

function bip32NetworkFromCoin(
  networkType: NetworkEnum,
  coin: Coin,
  sigType: BIP43PurposeTypeEnum = BIP43PurposeTypeEnum.Legacy
): BIP32Network {
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
  const network: BIP32Network = bip32NetworkFromCoin(
    mnemonicToXPrivArgs.network,
    mnemonicToXPrivArgs.coin,
    mnemonicToXPrivArgs.type
  )
  root.network = network
  const child: BIP32Interface = root.derivePath(mnemonicToXPrivArgs.path)
  return child.toBase58()
}

export function xprivToXPub(xprivToXPubArgs: XPrivToXPubArgs): string {
  const network: BIP32Network = bip32NetworkFromCoin(
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
  const network: BIP32Network = bip32NetworkFromCoin(
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
  const network: BIP32Network = bip32NetworkFromCoin(
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
  const network: BIP32Network = bip32NetworkFromCoin(
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
  const network: BIP32Network = bip32NetworkFromCoin(
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
  const network: BIP32Network = bip32NetworkFromCoin(
    xprivToPrivateKeyArgs.network,
    xprivToPrivateKeyArgs.coin,
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
  const network: BIP32Network = bip32NetworkFromCoin(
    wifToECPairArgs.network,
    wifToECPairArgs.coin
  )
  return bitcoin.ECPair.fromWIF(wifToECPairArgs.wifKey, network)
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
  psbt.signInput(0, createTxArgs.privateKey)
  psbt.validateSignaturesOfInput(0)
  psbt.finalizeAllInputs()
  return psbt.extractTransaction().toHex()
}
