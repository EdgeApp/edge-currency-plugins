import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  addressToScriptPubkey,
  AddressTypeEnum,
  BIP43PurposeTypeEnum,
  NetworkEnum,
  privateKeyToWIF,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  ScriptTypeEnum,
  seedOrMnemonicToXPriv,
  wifToPrivateKey,
  xprivToXPub,
  xpubToPubkey,
} from '../../../../../src/common/utxobased/keymanager/keymanager'

describe('dogecoin mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = seedOrMnemonicToXPriv({
      seed: mnemonic,
      network: NetworkEnum.Mainnet,
      purpose: BIP43PurposeTypeEnum.Legacy,
      coin: 'dogecoin',
    })
    expect(resultLegacy).to.equal(
      'dgpv57bftCH9z6cEAdAY9SCDV9NfVsygaQWdi5LuCXdumz5qUPWnw1S3YBM7PdHXMvA8oSGS6Pbes1xEHMd5Zi2qHVK45y5FKKXzBXsZcTtYmX5'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = seedOrMnemonicToXPriv({
      seed: mnemonic,
      network: NetworkEnum.Testnet,
      purpose: BIP43PurposeTypeEnum.Legacy,
      coin: 'dogecoin',
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('dogecoin bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'dgpv57bftCH9z6cEAdAY9SCDV9NfVsygaQWdi5LuCXdumz5qUPWnw1S3YBM7PdHXMvA8oSGS6Pbes1xEHMd5Zi2qHVK45y5FKKXzBXsZcTtYmX5',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'dogecoin',
    })
    expect(resultLegacy).to.equals(
      'dgub8rUhDtD3YFGZTUphBfpBbzvFxSMKQXYLzg87Me2ta78r2SdVLmypBUkkxrrn9RTnchsyiJSkHZyLWxD13ibBiXtuFWktBoDaGaZjQUBLNLs'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'dogecoin',
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
    )
  })
})

describe('dogecoin xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
  /*
    These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
    using the same seed as in other tests (abandon, ...)
    */

  it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'dgub8rUhDtD3YFGZTUphBfpBbzvFxSMKQXYLzg87Me2ta78r2SdVLmypBUkkxrrn9RTnchsyiJSkHZyLWxD13ibBiXtuFWktBoDaGaZjQUBLNLs',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'dogecoin',
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      scriptType: ScriptTypeEnum.p2pkh,
    }).scriptPubkey

    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'dogecoin',
    }).address
    expect(p2pkhAddress).to.equals('DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC')
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: 'DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'dogecoin',
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })
})

describe('dogecoin from WIF to private key to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'QPkeC1ZfHx3c9g7WTj9cQ8gnvk2iSAfAcbq1aVAWjNTwDAKfZUzx'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'dogecoin',
    })
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'dogecoin',
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })
})

describe('dogecoin guess script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC',
      network: NetworkEnum.Mainnet,
      coin: 'dogecoin',
    })
    expect(scriptPubkey).to.equal(
      '76a9144a483568665dcdfa68dd58a1f62893448a64333988ac'
    )
  })
})
