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

describe('eboost mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = seedOrMnemonicToXPriv({
      seed: mnemonic,
      network: NetworkEnum.Mainnet,
      purpose: BIP43PurposeTypeEnum.Legacy,
      coin: 'eboost',
    })
    expect(resultLegacy).to.equal(
      'xprv9zYTou2k1nf6MGqBjTJPr2sE3uZxtNs189FwEEsmm35n5jNVsv3pwVyUPpxWfeDwbhz1ByQW6eh6EFnPp34oEnDC1VZ22xapWJu3Ham3JYK'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = seedOrMnemonicToXPriv({
      seed: mnemonic,
      network: NetworkEnum.Testnet,
      purpose: BIP43PurposeTypeEnum.Legacy,
      coin: 'eboost',
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('eboost bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'eboost',
    })
    expect(resultLegacy).to.equals(
      'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'eboost',
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
    )
  })
})

describe('eboost xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
  /*
    These methods were cross verified with the old edge plugin tests
    using the same seed as in other tests (abandon, ...)
    */

  it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'eboost',
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      scriptType: ScriptTypeEnum.p2pkh,
    }).scriptPubkey

    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'eboost',
    })
    expect(p2pkhAddress).to.equals('eMvfrRkQqgc9igciD3j9tCrrmw2KzJ2yu4')
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: 'eMvfrRkQqgc9igciD3j9tCrrmw2KzJ2yu4',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'eboost',
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })
})

describe('eboost guess script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'eMvfrRkQqgc9igciD3j9tCrrmw2KzJ2yu4',
      network: NetworkEnum.Mainnet,
      coin: 'eboost',
    })
    expect(scriptPubkey).to.equal(
      '76a914d986ed01b7a22225a70edbf2ba7cfb63a15cb3aa88ac'
    )
  })
})

describe('eboost from WIF to private key to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'ZcSgeybBZAQ7y7eFUEfPk6ZDA2843QMAJBvEfFMvyQfi8HsHfgEq'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'eboost',
    })
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'eboost',
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })
})
