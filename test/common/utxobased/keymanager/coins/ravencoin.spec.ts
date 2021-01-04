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

describe('ravencoin mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = seedOrMnemonicToXPriv({
      seed: mnemonic,
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'ravencoin',
    })
    expect(resultLegacy).to.equal(
      'xprv9zG1qmEumfwLUb2rTjKTxJEfLRxBqMGYyYm4S6wXpJyjyqrnqWN2aYf4EEt6iv27QMeHWyzressEVbmgrRFoqJQX47F3ncu2ghzeRYPhTJc'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = seedOrMnemonicToXPriv({
      seed: mnemonic,
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'ravencoin',
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('ravencoin bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'xprv9zG1qmEumfwLUb2rTjKTxJEfLRxBqMGYyYm4S6wXpJyjyqrnqWN2aYf4EEt6iv27QMeHWyzressEVbmgrRFoqJQX47F3ncu2ghzeRYPhTJc',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'ravencoin',
    })
    expect(resultLegacy).to.equals(
      'xpub6DFNFGmoc3Vdh57KZkrUKSBPtTngEozQLmgfEVM9NeWireBwP3gH8LyY5VMsVB9zCGxzsph27TuppVSrbGP5sjqcJPrWLUwsEPrXPvCVgL1'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'ravencoin',
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
    )
  })
})

describe('ravencoin xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
  /*
    These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
    using the same seed as in other tests (abandon, ...)
    */

  it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'xpub6DFNFGmoc3Vdh57KZkrUKSBPtTngEozQLmgfEVM9NeWireBwP3gH8LyY5VMsVB9zCGxzsph27TuppVSrbGP5sjqcJPrWLUwsEPrXPvCVgL1',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'ravencoin',
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      scriptType: ScriptTypeEnum.p2pkh,
    }).scriptPubkey

    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'ravencoin',
    }).address
    expect(p2pkhAddress).to.equals('RDjNvZL1TJQ7R8L23jDutdEioQG4eTC38V')
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: 'RDjNvZL1TJQ7R8L23jDutdEioQG4eTC38V',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'ravencoin',
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })
})

describe('ravencoin from WIF to private key to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'L37GeVaqwRDGoeHckfe8DmzsbDTBgmEuMBAZ7KDPDHN6RpUovWRP'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'ravencoin',
    })
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'ravencoin',
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })
})

describe('ravencoin guess script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'RDjNvZL1TJQ7R8L23jDutdEioQG4eTC38V',
      network: NetworkEnum.Mainnet,
      coin: 'ravencoin',
    })
    expect(scriptPubkey).to.equal(
      '76a91430d45f1e2c0d24c8340bd0b634ce89c5b0e579b388ac'
    )
  })
})
