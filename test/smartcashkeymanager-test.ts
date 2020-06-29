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

describe('smartcash mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/224'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'smartcash'
    })
    expect(resultLegacy).to.equal(
      'xprv9yWirNER4qGZHR9cLGqJi8Z23wy2M9JmbCA7zkCunzneLv84Gxj4DmZkdjjkqotSverQ7pWsHnkPdFH2RqfkmSizzR6rZFHQ9cHSqjCKs3b'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'smartcash'
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('smartcash bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'xprv9yWirNER4qGZHR9cLGqJi8Z23wy2M9JmbCA7zkCunzneLv84Gxj4DmZkdjjkqotSverQ7pWsHnkPdFH2RqfkmSizzR6rZFHQ9cHSqjCKs3b',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'smartcash'
    })
    expect(resultLegacy).to.equals(
      'xpub6CW5FsmJuCprVuE5SJNK5GVkbyoWkc2cxR5io8cXMLKdDiTCpW3JmZtEUzKML8iYKp5Fs7iGSLnW4EjGZFaRtmVo9RPW36CY2w4imVdUNjK'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'smartcash'
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
    )
  })
})

describe('smartcash xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
  /*
    These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
    using the same seed as in other tests (abandon, ...)
    */

  it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'xpub6CW5FsmJuCprVuE5SJNK5GVkbyoWkc2cxR5io8cXMLKdDiTCpW3JmZtEUzKML8iYKp5Fs7iGSLnW4EjGZFaRtmVo9RPW36CY2w4imVdUNjK',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'smartcash'
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      addressType: AddressTypeEnum.p2pkh
    }).scriptPubkey

    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'smartcash'
    })
    expect(p2pkhAddress).to.equals('SkYmjrcQQgc9XWFAfBRG61YEYRWUoFKjcJ')
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: 'SkYmjrcQQgc9XWFAfBRG61YEYRWUoFKjcJ',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'smartcash'
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })
})

describe('smartcash from WIF to private key to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'KxU83MzcLXP1WJtoFJXMDMcN3z5ykAa9xLdFTDY5XpV4e6Zit9BA'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'smartcash'
    })
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'smartcash'
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })
})

describe('smartcash guess script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'SkYmjrcQQgc9XWFAfBRG61YEYRWUoFKjcJ',
      network: NetworkEnum.Mainnet,
      coin: 'smartcash'
    })
    expect(scriptPubkey).to.equal(
      '76a914ff1609403946409f74cd2c07e50c4c40ec66080288ac'
    )
  })
})
