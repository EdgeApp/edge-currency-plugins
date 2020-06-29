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
  wifToPrivateKey,
  xprivToXPub,
  xpubToPubkey
} from '../src/common/utxobased/keymanager/keymanager'

describe('vertcoin mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/28'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'vertcoin'
    })
    expect(resultLegacy).to.equal(
      'xprv9ymzu53azAnFBpJxehxAZi18cA112AVvbeBwMMjfHBieJwrqZjaV3EBE7k5yJPf7RfYBEJzwGKvZP1Gps312YU6BJvdobsd1CmD1xobGkrR'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'vertcoin'
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('vertcoin bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'xprv9ymzu53azAnFBpJxehxAZi18cA112AVvbeBwMMjfHBieJwrqZjaV3EBE7k5yJPf7RfYBEJzwGKvZP1Gps312YU6BJvdobsd1CmD1xobGkrR',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'vertcoin'
    })
    expect(resultLegacy).to.equals(
      'xpub6CmMJaaUpYLYQJPRkjVAvqwsABqVRdDmxs7Y9k9GqXFdBkBz7Gtjb2VhxzCeYKuXkEzZ23MNRFj9tqjYS5UgvewWpxYmhWuwDiLR84spHS8'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'vertcoin'
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
    )
  })
})

describe('vertcoin xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
  /*
    These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
    using the same seed as in other tests (abandon, ...)
    */

  it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'xpub6CmMJaaUpYLYQJPRkjVAvqwsABqVRdDmxs7Y9k9GqXFdBkBz7Gtjb2VhxzCeYKuXkEzZ23MNRFj9tqjYS5UgvewWpxYmhWuwDiLR84spHS8',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'vertcoin'
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      addressType: AddressTypeEnum.p2pkh
    }).scriptPubkey

    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'vertcoin'
    })
    expect(p2pkhAddress).to.equals('Vce16eJifb7HpuoTFEBJyKNLsBJPo7fM83')
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: 'Vce16eJifb7HpuoTFEBJyKNLsBJPo7fM83',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'vertcoin'
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })

  it('given an ypub, generate p2wpkh-p2sh address and cross verify script pubkey result', () => {
    const pubkeyP2WPKHP2SH = xpubToPubkey({
      xpub:
        'xpub6D1pK4ozztYgDWaNcvgYjXTQoWNfzSgQY9poZkJWhhbCKYVjQdUmhkRYF6NkLPNzTohQ3KEMm1ZqzZAHTPPQYuDYzVmkXtTLzLYPDhjoUrm',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'vertcoin'
    })
    const scriptPubkeyP2WPKHP2SH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2WPKHP2SH,
      addressType: AddressTypeEnum.p2wpkhp2sh
    }).scriptPubkey
    const p2wpkhp2shAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2WPKHP2SH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkhp2sh,
      coin: 'vertcoin'
    })
    expect(p2wpkhp2shAddress).to.equals('3GKaSv31kZoxGwMs2Kp25ngoHRHi5pz2SP')
    const scriptPubkeyP2WPKHP2SHRoundTrip = addressToScriptPubkey({
      address: '3GKaSv31kZoxGwMs2Kp25ngoHRHi5pz2SP',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkhp2sh,
      coin: 'vertcoin'
    })
    expect(scriptPubkeyP2WPKHP2SHRoundTrip).to.equals(scriptPubkeyP2WPKHP2SH)
  })

  it('given a zpub, generate p2wpkh address and cross verify script pubkey result', () => {
    const pubkeyP2WPKH = xpubToPubkey({
      xpub:
        'xpub6Cq877KwJnLWBSAoVoFLwoe7BbPhxxkpBkvEugZRzmWRsGqPJDJU3t8jWFuNWMR5uYLQuYPgypSR2F9HWjVaroCNtRqH43Chwjeox4je1yB',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Segwit,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'vertcoin'
    })
    const scriptPubkeyP2WPKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2WPKH,
      addressType: AddressTypeEnum.p2wpkh
    }).scriptPubkey
    const p2wpkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2WPKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'vertcoin'
    })
    expect(p2wpkhAddress).to.equals(
      'vtc1qfe8v6c4r39fq8xnjgcpunt5spdfcxw63zzfwru'
    )
    const scriptPubkeyP2WPKHRoundTrip = addressToScriptPubkey({
      address: 'vtc1qfe8v6c4r39fq8xnjgcpunt5spdfcxw63zzfwru',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'vertcoin'
    })
    expect(scriptPubkeyP2WPKHRoundTrip).to.be.equal(scriptPubkeyP2WPKH)
  })
})

describe('vertcoin from WIF to private key to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'KxQ19nBiiNeR743RdgwWxsYogKCWgjNKp9jT2ug8wvhJdXCP8HNh'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'vertcoin'
    })
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'vertcoin'
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })
})

describe('vertcoin guess script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'Vce16eJifb7HpuoTFEBJyKNLsBJPo7fM83',
      network: NetworkEnum.Mainnet,
      coin: 'vertcoin'
    })
    expect(scriptPubkey).to.equal(
      '76a9141cf825a7d790c30f6eef81f397a66c156540036e88ac'
    )
  })
  it('p2sh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: '3GKaSv31kZoxGwMs2Kp25ngoHRHi5pz2SP',
      network: NetworkEnum.Mainnet,
      coin: 'vertcoin'
    })
    expect(scriptPubkey).to.equal(
      'a914a07be28d5d535951b4882821e519391bf9a39f4987'
    )
  })

  it('p2wpkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'vtc1qfe8v6c4r39fq8xnjgcpunt5spdfcxw63zzfwru',
      network: NetworkEnum.Mainnet,
      coin: 'vertcoin'
    })
    expect(scriptPubkey).to.equal(
      '00144e4ecd62a38952039a724603c9ae900b53833b51'
    )
  })
})
