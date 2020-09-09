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

describe('dash mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/5'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'dash',
    })
    expect(resultLegacy).to.equal(
      'drkvjRAxdpDmxjUnQKX26VwVQ2mbVjXn67Tr4LZoyobdJyQpPW4ssDTnrcf1zHJui9XqpNuPYxZkHYymoZEowFHHCP6VZncvx9q9UNuerwSVDzr'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'dash',
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('dash bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'drkvjRAxdpDmxjUnQKX26VwVQ2mbVjXn67Tr4LZoyobdJyQpPW4ssDTnrcf1zHJui9XqpNuPYxZkHYymoZEowFHHCP6VZncvx9q9UNuerwSVDzr',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'dash',
    })
    expect(resultLegacy).to.equals(
      'drkpRzJp5yxNJdtLq7YmV6Bfg7NtjycEopwQtnqre1mPRoie9DPWBfCu23U5gVteaKYiMF3gaFd88RnZUfowGYoBoR4sWk4RApm4jrbSAGgQUdq'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'dash',
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
    )
  })
})

describe('dash xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
  /*
    These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
    using the same seed as in other tests (abandon, ...)
    */

  it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'drkpRzJp5yxNJdtLq7YmV6Bfg7NtjycEopwQtnqre1mPRoie9DPWBfCu23U5gVteaKYiMF3gaFd88RnZUfowGYoBoR4sWk4RApm4jrbSAGgQUdq',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'dash',
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      scriptType: ScriptTypeEnum.p2pkh,
    }).scriptPubkey

    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'dash',
    })
    expect(p2pkhAddress).to.equals('XoJA8qE3N2Y3jMLEtZ3vcN42qseZ8LvFf5')
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: 'XoJA8qE3N2Y3jMLEtZ3vcN42qseZ8LvFf5',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'dash',
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })
})

describe('dash from WIF to private key to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'XGihgbi7c1nVqrjkPSvzJydLVWYW7hTrcXdfSdpFMwi3Xhbabw93'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'dash',
    })
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'dash',
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })
})

describe('dash guess script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'XoJA8qE3N2Y3jMLEtZ3vcN42qseZ8LvFf5',
      network: NetworkEnum.Mainnet,
      coin: 'dash',
    })
    expect(scriptPubkey).to.equal(
      '76a9148a4f58c222cd5544c527bc66925652baa70b5e8088ac'
    )
  })
})
