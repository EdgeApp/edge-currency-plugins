import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  addressToScriptPubkey,
  AddressTypeEnum,
  BIP43PurposeTypeEnum,
  privateKeyToWIF,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  ScriptTypeEnum,
  seedOrMnemonicToXPriv,
  wifToPrivateKey,
  xprivToXPub,
  xpubToPubkey,
} from '../../../../../src/common/utxobased/keymanager/keymanager'
import { NetworkEnum } from '../../../../../src/common/plugin/types'

describe('smartcash mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = seedOrMnemonicToXPriv({
      seed: mnemonic,
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'smartcash',
    })
    expect(resultLegacy).to.equal(
      'xprv9yWirNER4qGZHR9cLGqJi8Z23wy2M9JmbCA7zkCunzneLv84Gxj4DmZkdjjkqotSverQ7pWsHnkPdFH2RqfkmSizzR6rZFHQ9cHSqjCKs3b'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = seedOrMnemonicToXPriv({
      seed: mnemonic,
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'smartcash',
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('smartcash bip32 prefix tests for the conversion from xpriv to xpub', () => {
  // verified with old edge library tests
  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'xprv9yWirNER4qGZHR9cLGqJi8Z23wy2M9JmbCA7zkCunzneLv84Gxj4DmZkdjjkqotSverQ7pWsHnkPdFH2RqfkmSizzR6rZFHQ9cHSqjCKs3b',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'smartcash',
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
      coin: 'smartcash',
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
      coin: 'smartcash',
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      scriptType: ScriptTypeEnum.p2pkh,
    }).scriptPubkey

    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'smartcash',
    }).address
    expect(p2pkhAddress).to.equals('SkYmjrcQQgc9XWFAfBRG61YEYRWUqGEZnG')
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: 'SkYmjrcQQgc9XWFAfBRG61YEYRWUqGEZnG',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'smartcash',
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })
})

describe('smartcash from WIF to private key to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'VLqHRdvdNPgspEjPM6ee5CcLKc4CFBvafN183pevjxXKX1uZGe1m'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'smartcash',
    })
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'smartcash',
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })
})

describe('smartcash guess script pubkeys from address', () => {
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'ScZ5enspA3DpbSkX1SYxkCLyu8gh4qzTWH',
      network: NetworkEnum.Mainnet,
      coin: 'smartcash',
    })
    expect(scriptPubkey).to.equal(
      '76a914a763fb8d08fdd6b5f6e3e3bf41ab33901b86e72088ac'
    )
  })
})
