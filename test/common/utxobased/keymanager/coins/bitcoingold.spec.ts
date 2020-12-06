import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  addressToScriptPubkey,
  AddressTypeEnum,
  BIP43PurposeTypeEnum,
  mnemonicToXPriv,
  NetworkEnum,
  privateKeyToWIF,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  ScriptTypeEnum,
  wifToPrivateKey,
  xprivToXPub,
  xpubToPubkey,
} from '../../../../../src/common/utxobased/keymanager/keymanager'

describe('bitcoin gold mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/156'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'bitcoingold',
    })
    expect(resultLegacy).to.equal(
      'xprv9xwq8XoNMYibm1tgqx9MknBEhV2piDRtYrVLdbRFHaQiYc8Y3yxhWVBui2Pcw6GK1GjhMMsY9qnJAAFEW5QhvvQP8wCyBRMnnGCSADhBBY5'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'bitcoingold',
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('bitcoin gold bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'xprv9xwq8XoNMYibm1tgqx9MknBEhV2piDRtYrVLdbRFHaQiYc8Y3yxhWVBui2Pcw6GK1GjhMMsY9qnJAAFEW5QhvvQP8wCyBRMnnGCSADhBBY5',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'bitcoingold',
    })
    expect(resultLegacy).to.equals(
      'xpub6BwBY3LGBvGtyVy9wygN7v7yFWsK7g9jv5QwRyprquwhRQTgbXGx4HWPZHRnF5ueji94Dztce4k3RJnt2ir3xWBS7y6bDk8ryS8vKXyoYPL'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'bitcoingold',
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
    )
  })
})

describe('bitcoin gold xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
  /*
    These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
    using the same seed as in other tests (abandon, ...)
    */

  it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'xpub6BwBY3LGBvGtyVy9wygN7v7yFWsK7g9jv5QwRyprquwhRQTgbXGx4HWPZHRnF5ueji94Dztce4k3RJnt2ir3xWBS7y6bDk8ryS8vKXyoYPL',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      changeIndex: 0,
      addressIndex: 0,
      coin: 'bitcoingold',
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      scriptType: ScriptTypeEnum.p2pkh,
    }).scriptPubkey

    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'bitcoingold',
    })
    expect(p2pkhAddress).to.equals('GeTZ7bjfXtGsyEcerSSFJNUSZwLfjtCJX9')
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: 'GeTZ7bjfXtGsyEcerSSFJNUSZwLfjtCJX9',
      network: NetworkEnum.Mainnet,
      coin: 'bitcoingold',
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })

  it('given an ypub, generate p2wpkh-p2sh address and cross verify script pubkey result', () => {
    const pubkeyP2WPKHP2SH = xpubToPubkey({
      xpub:
        'ypub6Wu2Ax4NRoLJW1UCNBRMatwYW5Vr7vqgE4SK6FdKssNEUA2NCor8c5oSdMTUgHT3V9yj1LzMLTJpXwCh7hVenJdfhLB9M6qxmi6bcoFSdVd',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      changeIndex: 0,
      addressIndex: 0,
      coin: 'bitcoingold',
    })
    const scriptPubkeyP2WPKHP2SH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2WPKHP2SH,
      scriptType: ScriptTypeEnum.p2wpkhp2sh,
    }).scriptPubkey
    const p2wpkhp2shAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2WPKHP2SH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2sh,
      coin: 'bitcoingold',
    })
    expect(p2wpkhp2shAddress).to.equals('AL8uaqKrP4n61pb2BrQXpMC3VcUdjmpAwn')
    const scriptPubkeyP2WPKHP2SHRoundTrip = addressToScriptPubkey({
      address: 'AL8uaqKrP4n61pb2BrQXpMC3VcUdjmpAwn',
      network: NetworkEnum.Mainnet,
      coin: 'bitcoingold',
    })
    expect(scriptPubkeyP2WPKHP2SHRoundTrip).to.equals(scriptPubkeyP2WPKHP2SH)
  })

  it('given a zpub, generate p2wpkh address and cross verify script pubkey result', () => {
    const pubkeyP2WPKH = xpubToPubkey({
      xpub:
        'zpub6sBMnpX8349mvyqk3Y4U1mTJAeCpY4qGNgMeJejYe1sjPYyVVs6qBDrycdTNd7kHXCZBUxuTB9kojxvHKVU6kS9hsoUeekK1QRBU9nDYtx2',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Segwit,
      changeIndex: 0,
      addressIndex: 0,
      coin: 'bitcoingold',
    })
    const scriptPubkeyP2WPKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2WPKH,
      scriptType: ScriptTypeEnum.p2wpkh,
    }).scriptPubkey
    const p2wpkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2WPKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'bitcoingold',
    })
    expect(p2wpkhAddress).to.equals(
      'btg1qkwnu2phwvard2spr2n0a9d84x590ahywl3yacu'
    )
    const scriptPubkeyP2WPKHRoundTrip = addressToScriptPubkey({
      address: 'btg1qkwnu2phwvard2spr2n0a9d84x590ahywl3yacu',
      network: NetworkEnum.Mainnet,
      coin: 'bitcoingold',
    })
    expect(scriptPubkeyP2WPKHRoundTrip).to.be.equal(scriptPubkeyP2WPKH)
  })
})

describe('bitcoin gold from WIF to private key to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'L4gU3tKvsS3XQ5eJXDARFEnMyoCvE8vsoYBngMAJESexY5yHsdkJ'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'bitcoingold',
    })
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'bitcoingold',
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })
})

describe('bitcoin gold guess script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'GeTZ7bjfXtGsyEcerSSFJNUSZwLfjtCJX9',
      network: NetworkEnum.Mainnet,
      coin: 'bitcoingold',
    })
    expect(scriptPubkey).to.equal(
      '76a914e21fb547704ff606ba769b9d6d7985f4cca760f788ac'
    )
  })
  it('p2sh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'AL8uaqKrP4n61pb2BrQXpMC3VcUdjmpAwn',
      network: NetworkEnum.Mainnet,
      coin: 'bitcoingold',
    })
    expect(scriptPubkey).to.equal(
      'a9142fdadae8827ecedb668946c073ebbb0482820c6387'
    )
  })

  it('p2wpkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'btg1qkwnu2phwvard2spr2n0a9d84x590ahywl3yacu',
      network: NetworkEnum.Mainnet,
      coin: 'bitcoingold',
    })
    expect(scriptPubkey).to.equal(
      '0014b3a7c506ee6746d5402354dfd2b4f5350afedc8e'
    )
  })
})
