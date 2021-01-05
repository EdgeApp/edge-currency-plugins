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

describe('feathercoin mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = seedOrMnemonicToXPriv({
      seed: mnemonic,
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'feathercoin',
    })
    expect(resultLegacy).to.equal(
      'xqMPAtc6rF1XptQ6QavaQ5fNyJkDgrZ3BLW4qwzMiDKmnRV4jWoDQHFdCzFMCJfXvxNtVcMW3rdD2FGVd54ygV72BVHNDMkr3k1HE3dE6NdQwc8'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = seedOrMnemonicToXPriv({
      seed: mnemonic,
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'feathercoin',
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('feathercoin bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'xqMPAtc6rF1XptQ6QavaQ5fNyJkDgrZ3BLW4qwzMiDKmnRV4jWoDQHFdCzFMCJfXvxNtVcMW3rdD2FGVd54ygV72BVHNDMkr3k1HE3dE6NdQwc8',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'feathercoin',
    })
    expect(resultLegacy).to.equals(
      'xq1vow2yefS81cbgEiWByGtkSSpvaKbitriBYioqhEvBRmRnoHaozKGHmnJCkisCuwv1NebnzGWLsuPwjZZABdb8f42MtkJqekEzqo7q7hUCpvB'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'feathercoin',
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
    )
  })
})

describe('feathercoin xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
  /*
    These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
    using the same seed as in other tests (abandon, ...)
    */

  it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'xq1vow2yefS81cbgEiWByGtkSSpvaKbitriBYioqhEvBRmRnoHaozKGHmnJCkisCuwv1NebnzGWLsuPwjZZABdb8f42MtkJqekEzqo7q7hUCpvB',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'feathercoin',
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      scriptType: ScriptTypeEnum.p2pkh,
    }).scriptPubkey

    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'feathercoin',
    }).address
    expect(p2pkhAddress).to.equals('6foXhTEUMC85RAhkPS2MfoxD6oS69x4rBS')
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: '6foXhTEUMC85RAhkPS2MfoxD6oS69x4rBS',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'feathercoin',
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })

  it('given an ypub, generate p2wpkh-p2sh address and cross verify script pubkey result', () => {
    const pubkeyP2WPKHP2SH = xpubToPubkey({
      xpub:
        'ypub6Wu2Ax4NRoLJW1UCNBRMatwYW5Vr7vqgE4SK6FdKssNEUA2NCor8c5oSdMTUgHT3V9yj1LzMLTJpXwCh7hVenJdfhLB9M6qxmi6bcoFSdVd',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'feathercoin',
    })
    const scriptPubkeyP2WPKHP2SH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2WPKHP2SH,
      scriptType: ScriptTypeEnum.p2wpkhp2sh,
    }).scriptPubkey
    const p2wpkhp2shAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2WPKHP2SH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2sh,
      coin: 'feathercoin',
    }).address
    expect(p2wpkhp2shAddress).to.equals('3643rsxfbpSKJ25TkJQo66HtAXqf2hGP3i')
    const scriptPubkeyP2WPKHP2SHRoundTrip = addressToScriptPubkey({
      address: '3643rsxfbpSKJ25TkJQo66HtAXqf2hGP3i',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2sh,
      coin: 'feathercoin',
    })
    expect(scriptPubkeyP2WPKHP2SHRoundTrip).to.equals(scriptPubkeyP2WPKHP2SH)
  })

  it('given a zpub, generate p2wpkh address and cross verify script pubkey result', () => {
    const pubkeyP2WPKH = xpubToPubkey({
      xpub:
        'zpub6sBMnpX8349mvyqk3Y4U1mTJAeCpY4qGNgMeJejYe1sjPYyVVs6qBDrycdTNd7kHXCZBUxuTB9kojxvHKVU6kS9hsoUeekK1QRBU9nDYtx2',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Segwit,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'feathercoin',
    })
    const scriptPubkeyP2WPKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2WPKH,
      scriptType: ScriptTypeEnum.p2wpkh,
    }).scriptPubkey
    const p2wpkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2WPKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'feathercoin',
    }).address
    expect(p2wpkhAddress).to.equals(
      'fc1qkwnu2phwvard2spr2n0a9d84x590ahywnuszd4'
    )
    const scriptPubkeyP2WPKHRoundTrip = addressToScriptPubkey({
      address: 'fc1qkwnu2phwvard2spr2n0a9d84x590ahywnuszd4',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'feathercoin',
    })
    expect(scriptPubkeyP2WPKHRoundTrip).to.be.equal(scriptPubkeyP2WPKH)
  })
})

describe('feathercoin from WIF to private key to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'N7sWmZgvC2X451cLTriK8PD8tnUGhRMJkNNaarmLpJP9aJBLBgA4'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'feathercoin',
    })
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'feathercoin',
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })
})

describe('feathercoin guess script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: '6foXhTEUMC85RAhkPS2MfoxD6oS69x4rBS',
      network: NetworkEnum.Mainnet,
      coin: 'feathercoin',
    })
    expect(scriptPubkey).to.equal(
      '76a91416b60429ed63dedf0d83d004bc4464130ee4cefb88ac'
    )
  })
  it('p2sh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: '3643rsxfbpSKJ25TkJQo66HtAXqf2hGP3i',
      network: NetworkEnum.Mainnet,
      coin: 'feathercoin',
    })
    expect(scriptPubkey).to.equal(
      'a9142fdadae8827ecedb668946c073ebbb0482820c6387'
    )
  })

  it('p2wpkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'fc1qkwnu2phwvard2spr2n0a9d84x590ahywnuszd4',
      network: NetworkEnum.Mainnet,
      coin: 'feathercoin',
    })
    expect(scriptPubkey).to.equal(
      '0014b3a7c506ee6746d5402354dfd2b4f5350afedc8e'
    )
  })
})
