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

describe('zcoin mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/136'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'zcoin'
    })
    expect(resultLegacy).to.equal(
      'xprv9yDcvGwNLgwS8rV5AYuupanjnfAoDZksQkDdXagMv5MAfrdSaKhoxqhic4NupSGNXtg1eqoAH7UezJMFoBfNNZHL2wVHjX1hEfU1xhceu8b'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'zcoin'
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('zcoin bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'xprv9yDcvGwNLgwS8rV5AYuupanjnfAoDZksQkDdXagMv5MAfrdSaKhoxqhic4NupSGNXtg1eqoAH7UezJMFoBfNNZHL2wVHjX1hEfU1xhceu8b',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'zcoin'
    })
    expect(resultLegacy).to.equals(
      'xpub6CCyKnUGB4VjMLZYGaSvBijULh1Hd2Uimy9EKy5yUQt9Yexb7s24We2CTM54hWaQZYhCzSR6yEFAs5cQ8TwbaSn53S6HRrmaFkdgqczb85v'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'zcoin'
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
    )
  })
})

describe('zcoin xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
  /*
    These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
    using the same seed as in other tests (abandon, ...)
    */

  it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'xpub6CCyKnUGB4VjMLZYGaSvBijULh1Hd2Uimy9EKy5yUQt9Yexb7s24We2CTM54hWaQZYhCzSR6yEFAs5cQ8TwbaSn53S6HRrmaFkdgqczb85v',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'zcoin'
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      addressType: AddressTypeEnum.p2pkh
    }).scriptPubkey

    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'zcoin'
    })
    expect(p2pkhAddress).to.equals('a1bW3sVVUsLqgKuTMXtSaAHGvpxKwugxPH')
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: 'a1bW3sVVUsLqgKuTMXtSaAHGvpxKwugxPH',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'zcoin'
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })
})

describe('zcoin from WIF to private key to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'Y6U2XvHuURXs7sDsokirN2CwZedNeGdkSA3dNBMPKqFpBttBeH8s'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'zcoin'
    })
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'zcoin'
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })
})

describe('zcoin guess script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'a1bW3sVVUsLqgKuTMXtSaAHGvpxKwugxPH',
      network: NetworkEnum.Mainnet,
      coin: 'zcoin'
    })
    expect(scriptPubkey).to.equal(
      '76a91409a72463ad9977d0b81baacbf25054de672d69f088ac'
    )
  })
})
