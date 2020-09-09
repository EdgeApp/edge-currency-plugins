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
} from '../src/common/utxobased/keymanager/keymanager'

describe('digibyte mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/20'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'digibyte',
    })
    expect(resultLegacy).to.equal(
      'xprv9yjgD7qdk99UwHsGUwGeqAy1QpKrYUPuZsb2ApTfE8cv4Nuij5G7HcnCMaxPU1m4bADnR4kqHnJsvW9LHvUcoLcmKLYLzjd3FGJr1CxdxWy'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'digibyte',
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('digibyte bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'xprv9yjgD7qdk99UwHsGUwGeqAy1QpKrYUPuZsb2ApTfE8cv4Nuij5G7HcnCMaxPU1m4bADnR4kqHnJsvW9LHvUcoLcmKLYLzjd3FGJr1CxdxWy',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'digibyte',
    })
    expect(resultLegacy).to.equals(
      'xpub6Cj2cdNXaWhn9mwjaxofCJujxrALww7kw6WcyCsGnU9twBEsGcaMqR6gCtQ9b3k6awqL2egNaat2btUCVoETYzcmngU9outdn6RA2KxmNEn'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'digibyte',
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
    )
  })
})

describe('digibyte xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
  /*
    These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
    using the same seed as in other tests (abandon, ...)
    */

  it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'xpub6Cj2cdNXaWhn9mwjaxofCJujxrALww7kw6WcyCsGnU9twBEsGcaMqR6gCtQ9b3k6awqL2egNaat2btUCVoETYzcmngU9outdn6RA2KxmNEn',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'digibyte',
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      scriptType: ScriptTypeEnum.p2pkh,
    }).scriptPubkey

    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'digibyte',
    })
    expect(p2pkhAddress).to.equals('DG1KhhBKpsyWXTakHNezaDQ34focsXjN1i')
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: 'DG1KhhBKpsyWXTakHNezaDQ34focsXjN1i',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'digibyte',
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })

  it('given an ypub, generate p2wpkh-p2sh address and cross verify script pubkey result', () => {
    const pubkeyP2WPKHP2SH = xpubToPubkey({
      xpub:
        'ypub6YAzMR6Pck8es9hsWTDoHUw95DS2ajZtmf6k9epK6aUoteJe5LWEtsW6ys97MqeK18CJe2MDYXWaitVDwogT46t6F7uGrHHk9VHzvxoX5in',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'digibyte',
    })
    const scriptPubkeyP2WPKHP2SH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2WPKHP2SH,
      scriptType: ScriptTypeEnum.p2wpkhp2sh,
    }).scriptPubkey
    const p2wpkhp2shAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2WPKHP2SH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2sh,
      coin: 'digibyte',
    })
    expect(p2wpkhp2shAddress).to.equals('SQ9EXABrHztGgefL9aH3FyeRjowdjtLfn4')
    const scriptPubkeyP2WPKHP2SHRoundTrip = addressToScriptPubkey({
      address: 'SQ9EXABrHztGgefL9aH3FyeRjowdjtLfn4',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2sh,
      coin: 'digibyte',
    })
    expect(scriptPubkeyP2WPKHP2SHRoundTrip).to.equals(scriptPubkeyP2WPKHP2SH)
  })

  it('given a zpub, generate p2wpkh address and cross verify script pubkey result', () => {
    const pubkeyP2WPKH = xpubToPubkey({
      xpub:
        'zpub6qSFywPULarUNuzKdbWVZwFpYnb2igv9AqLCufRkXwWfexmdhkAgAsosnc3UiYaBNWBHm3DpuCfmwEG9g27X5t6vKGuLq7jvtsmLoCBMw3j',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Segwit,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'digibyte',
    })
    const scriptPubkeyP2WPKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2WPKH,
      scriptType: ScriptTypeEnum.p2wpkh,
    }).scriptPubkey
    const p2wpkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2WPKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'digibyte',
    })
    expect(p2wpkhAddress).to.equals(
      'dgb1q9gmf0pv8jdymcly6lz6fl7lf6mhslsd72e2jq8'
    )
    const scriptPubkeyP2WPKHRoundTrip = addressToScriptPubkey({
      address: 'dgb1q9gmf0pv8jdymcly6lz6fl7lf6mhslsd72e2jq8',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'digibyte',
    })
    expect(scriptPubkeyP2WPKHRoundTrip).to.be.equal(scriptPubkeyP2WPKH)
  })
})

describe('digibyte from WIF to private key to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'L1CAcXSxB48WoRs91gjSaj8eerBj3ruTyun7MvqBpnrc62cXAJqq'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'digibyte',
    })
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'digibyte',
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })
})

describe('digibyte guess script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'DG1KhhBKpsyWXTakHNezaDQ34focsXjN1i',
      network: NetworkEnum.Mainnet,
      coin: 'digibyte',
    })
    expect(scriptPubkey).to.equal(
      '76a91477310b27af676f9663881f649860a327d28777be88ac'
    )
  })
  it('p2sh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'SQ9EXABrHztGgefL9aH3FyeRjowdjtLfn4',
      network: NetworkEnum.Mainnet,
      coin: 'digibyte',
    })
    expect(scriptPubkey).to.equal(
      'a9141f3fe4a26b7d41be615d020c177c20882a2d95d287'
    )
  })

  it('p2wpkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'dgb1q9gmf0pv8jdymcly6lz6fl7lf6mhslsd72e2jq8',
      network: NetworkEnum.Mainnet,
      coin: 'digibyte',
    })
    expect(scriptPubkey).to.equal(
      '00142a369785879349bc7c9af8b49ffbe9d6ef0fc1be'
    )
  })
})
