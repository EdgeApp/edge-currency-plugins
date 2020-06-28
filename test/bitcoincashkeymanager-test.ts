import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  addressToScriptHash,
  addressToScriptPubkey,
  AddressTypeEnum,
  BIP43PurposeTypeEnum,
  mnemonicToXPriv,
  NetworkEnum,
  PrivateKeyToWIF,
  scriptHashToAddress,
  wifToPrivateKey,
  xprivToXPub,
  xpubToScriptHash
} from '../src/utxobased/keymanager/keymanager'

describe('bitcoin cash mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/145'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'bitcoincash'
    })
    expect(resultLegacy).to.equal(
      'xprv9xywTsqYa9uDLdJs8QpXf7xwRWgPw4rq5FtkcShsDoZTqfNQjVQ3dDCdyedXX3FqB18U8e8PfVMeFqkhzPGseKVMDjGe5rPdiUXMxy7BQNJ'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'bitcoincash'
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('bitcoin cash bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'xprv9xywTsqYa9uDLdJs8QpXf7xwRWgPw4rq5FtkcShsDoZTqfNQjVQ3dDCdyedXX3FqB18U8e8PfVMeFqkhzPGseKVMDjGe5rPdiUXMxy7BQNJ',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'bitcoincash'
    })
    expect(resultLegacy).to.equals(
      'xpub6ByHsPNSQXTWZ7PLESMY2FufyYWtLXagSUpMQq7Un96SiThZH2iJB1X7pwviH1WtKVeDP6K8d6xxFzzoaFzF3s8BKCZx8oEDdDkNnp4owAZ'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'bitcoincash'
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
    )
  })
})

describe('bitcoin cash xpub to address tests; generate valid addresses by calling xpubToScriptHash and scriptHashToAddress', () => {
  /*
  These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
  using the same seed as in other tests (abandon, ...)
  */

  it('given an xpub, generate p2pkh address and cross verify scriptHash (pubkey hash) result', () => {
    const scriptHashP2PKH = xpubToScriptHash({
      xpub:
        'xpub6ByHsPNSQXTWZ7PLESMY2FufyYWtLXagSUpMQq7Un96SiThZH2iJB1X7pwviH1WtKVeDP6K8d6xxFzzoaFzF3s8BKCZx8oEDdDkNnp4owAZ',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      addressType: AddressTypeEnum.p2pkh,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'bitcoincash'
    }).scriptHash
    const p2pkhAddress = scriptHashToAddress({
      scriptHash: scriptHashP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.cashaddrP2PKH,
      coin: 'bitcoincash'
    })
    expect(p2pkhAddress).to.equals(
      'bitcoincash:qqyx49mu0kkn9ftfj6hje6g2wfer34yfnq5tahq3q6'
    )
    const scriptHashP2PKHRoundTrip = addressToScriptHash({
      address: 'bitcoincash:qqyx49mu0kkn9ftfj6hje6g2wfer34yfnq5tahq3q6',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.cashaddrP2PKH,
      coin: 'bitcoincash'
    })
    // TODO: Drop this string comparison and use equals bytes instead
    expect(scriptHashP2PKHRoundTrip?.toString()).to.equals(
      scriptHashP2PKH?.toString()
    )
  })

  it('given an xpub, generate p2pkh testnet address and cross verify scriptHash (pubkey hash) result', () => {
    const scriptHashP2PKH = xpubToScriptHash({
      xpub:
        'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      addressType: AddressTypeEnum.p2pkh,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'bitcoincash'
    }).scriptHash
    const p2pkhAddress = scriptHashToAddress({
      scriptHash: scriptHashP2PKH,
      network: NetworkEnum.Testnet,
      addressType: AddressTypeEnum.cashaddrP2PKH,
      coin: 'bitcoincash'
    })
    expect(p2pkhAddress).to.equals(
      'bitcoincashtestnet:qqaz6s295ncfs53m86qj0uw6sl8u2kuw0yjdsvk7h8'
    )
    const scriptHashP2PKHRoundTrip = addressToScriptHash({
      address: 'bitcoincashtestnet:qqaz6s295ncfs53m86qj0uw6sl8u2kuw0yjdsvk7h8',
      network: NetworkEnum.Testnet,
      addressType: AddressTypeEnum.cashaddrP2PKH,
      coin: 'bitcoincash'
    })
    // TODO: Drop this string comparison and use equals bytes instead
    expect(scriptHashP2PKHRoundTrip?.toString()).to.equals(
      scriptHashP2PKH?.toString()
    )
  })
})

describe('bitcoin cash from WIF to private key buffer to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'KxbEv3FeYig2afQp7QEA9R3gwqdTBFwAJJ6Ma7j1SkmZoxC9bAXZ'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'bitcoincash'
    })
    const wifKeyRoundTrip = PrivateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'bitcoincash'
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })
})

describe('bitcoin cash get script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'bitcoincash:qr9q6dsyfcxupz3zwf805mm2q7cwcnre4g60ww9wd5',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.cashaddrP2PKH,
      coin: 'bitcoincash'
    })
    expect(scriptPubkey).to.equal(
      '76a914ca0d36044e0dc08a22724efa6f6a07b0ec4c79aa88ac'
    )
  })
  it('p2pkh testnet address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'bchtest:qrall9d5uddv4yvdyms4wwfw59jr5twzsvashd0fst',
      network: NetworkEnum.Testnet,
      addressType: AddressTypeEnum.cashaddrP2PKH,
      coin: 'bitcoincash'
    })
    expect(scriptPubkey).to.equal(
      '76a914fbff95b4e35aca918d26e157392ea1643a2dc28388ac'
    )
  })
  it('p2sh mainnet address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'bitcoincash:pz689gnx6z7cnsfhq6jpxtx0k9hhcwulev5cpumfk0',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.cashaddrP2SH,
      coin: 'bitcoincash'
    })
    expect(scriptPubkey).to.equal(
      'a914b472a266d0bd89c13706a4132ccfb16f7c3b9fcb87'
    )
  })
  it('p2sh testnet address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'bchtest:pq2wfeuppegjpnrg64ws8vmv7e4fatwzwq9rvngx8x',
      network: NetworkEnum.Testnet,
      addressType: AddressTypeEnum.cashaddrP2SH,
      coin: 'bitcoincash'
    })
    expect(scriptPubkey).to.equal(
      'a91414e4e7810e5120cc68d55d03b36cf66a9eadc27087'
    )
  })
})

describe('bitcoin cash guess script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'bitcoincash:qr9q6dsyfcxupz3zwf805mm2q7cwcnre4g60ww9wd5',
      network: NetworkEnum.Mainnet,
      coin: 'bitcoincash'
    })
    expect(scriptPubkey).to.equal(
      '76a914ca0d36044e0dc08a22724efa6f6a07b0ec4c79aa88ac'
    )
  })
  it('p2pkh testnet address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'bchtest:qrall9d5uddv4yvdyms4wwfw59jr5twzsvashd0fst',
      network: NetworkEnum.Testnet,
      coin: 'bitcoincash'
    })
    expect(scriptPubkey).to.equal(
      '76a914fbff95b4e35aca918d26e157392ea1643a2dc28388ac'
    )
  })
  it('p2sh mainnet address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'bitcoincash:pz689gnx6z7cnsfhq6jpxtx0k9hhcwulev5cpumfk0',
      network: NetworkEnum.Mainnet,
      coin: 'bitcoincash'
    })
    expect(scriptPubkey).to.equal(
      'a914b472a266d0bd89c13706a4132ccfb16f7c3b9fcb87'
    )
  })
  it('p2sh testnet address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'bchtest:pq2wfeuppegjpnrg64ws8vmv7e4fatwzwq9rvngx8x',
      network: NetworkEnum.Testnet,
      coin: 'bitcoincash'
    })
    expect(scriptPubkey).to.equal(
      'a91414e4e7810e5120cc68d55d03b36cf66a9eadc27087'
    )
  })
})
