import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  addressToScriptPubkey,
  AddressTypeEnum,
  BIP43PurposeTypeEnum,
  mnemonicToXPriv,
  NetworkEnum,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  ScriptTypeEnum,
  xprivToXPub,
  xpubToPubkey,
} from '../src/common/utxobased/keymanager/keymanager'

describe('decred mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/156'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'decred',
    })
    expect(resultLegacy).to.equal(
      'dprv3o8pLs3xWbQUcPFT19CVo7NgS6GKpRbR9ib9m6RR5TEzXhfCFUq1hHhHK7BUxqqpG7WP7KYuRH3rMibWqqYSnSRxeUxv57oXdV1BmJ6Qw5Y'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'decred',
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('decred bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'dprv3o8pLs3xWbQUcPFT19CVo7NgS6GKpRbR9ib9m6RR5TEzXhfCFUq1hHhHK7BUxqqpG7WP7KYuRH3rMibWqqYSnSRxeUxv57oXdV1BmJ6Qw5Y',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'decred',
    })
    expect(resultLegacy).to.equals(
      'dpubZEvuhzcFayUGWo9DFfFrKLAw46pbFNBVMGDUW1Mn5XqdFFgq8SAcmsDJTotAMMkqgQvGRtARQUzaYAvdT4zy7YwomLzYC8KLW6KdBqP9nsC'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'decred',
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
    )
  })
})

describe('decred xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
  /*
    These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
    using the same seed as in other tests (abandon, ...)
    */

  it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'dpubZEvuhzcFayUGWo9DFfFrKLAw46pbFNBVMGDUW1Mn5XqdFFgq8SAcmsDJTotAMMkqgQvGRtARQUzaYAvdT4zy7YwomLzYC8KLW6KdBqP9nsC',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'decred',
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      scriptType: ScriptTypeEnum.p2pkh,
    }).scriptPubkey

    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'decred',
    })
    expect(p2pkhAddress).to.equals('DsmaYBuL9cgEswnx4KjeLQC2uAWUdRyVXhg')
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: 'DsmaYBuL9cgEswnx4KjeLQC2uAWUdRyVXhg',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'decred',
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })
})

describe('decred guess script pubkeys from address', () => {
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'DsmaYBuL9cgEswnx4KjeLQC2uAWUdRyVXhg',
      network: NetworkEnum.Mainnet,
      coin: 'decred',
    })
    expect(scriptPubkey).to.equal(
      '76a914e21fb547704ff606ba769b9d6d7985f4cca760f788ac'
    )
    const address = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkey,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'decred',
    })
    expect(address).to.equal('DsmaYBuL9cgEswnx4KjeLQC2uAWUdRyVXhg')
  })
  it('p2sh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'DcbpczkMzqtYozqrX7vHcFQmCF5wqsW2hYW',
      network: NetworkEnum.Mainnet,
      coin: 'decred',
    })
    expect(scriptPubkey).to.equal(
      'a9142fdadae8827ecedb668946c073ebbb0482820c6387'
    )
    const address = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkey,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2sh,
      coin: 'decred',
    })
    expect(address).to.equal('DcbpczkMzqtYozqrX7vHcFQmCF5wqsW2hYW')
  })
})
