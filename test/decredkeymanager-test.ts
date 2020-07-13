import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  // addressToScriptPubkey,
  // AddressTypeEnum,
  BIP43PurposeTypeEnum,
  mnemonicToXPriv,
  NetworkEnum,
  privateKeyToWIF,
  // pubkeyToScriptPubkey,
  // scriptPubkeyToAddress,
  wifToPrivateKey,
  xprivToXPub,
  // xpubToPubkey,
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

// describe('decred xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
//   /*
//     These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
//     using the same seed as in other tests (abandon, ...)
//     */

//   it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
//     const pubkeyP2PKH = xpubToPubkey({
//       xpub:
//         'xpub6BwBY3LGBvGtyVy9wygN7v7yFWsK7g9jv5QwRyprquwhRQTgbXGx4HWPZHRnF5ueji94Dztce4k3RJnt2ir3xWBS7y6bDk8ryS8vKXyoYPL',
//       network: NetworkEnum.Mainnet,
//       type: BIP43PurposeTypeEnum.Legacy,
//       bip44ChangeIndex: 0,
//       bip44AddressIndex: 0,
//       coin: 'decred',
//     })
//     const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
//       pubkey: pubkeyP2PKH,
//       addressType: AddressTypeEnum.p2pkh,
//     }).scriptPubkey

//     const p2pkhAddress = scriptPubkeyToAddress({
//       scriptPubkey: scriptPubkeyP2PKH,
//       network: NetworkEnum.Mainnet,
//       addressType: AddressTypeEnum.p2pkh,
//       coin: 'decred',
//     })
//     expect(p2pkhAddress).to.equals('GeTZ7bjfXtGsyEcerSSFJNUSZwLfjtCJX9')
//     const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
//       address: 'GeTZ7bjfXtGsyEcerSSFJNUSZwLfjtCJX9',
//       network: NetworkEnum.Mainnet,
//       addressType: AddressTypeEnum.p2pkh,
//       coin: 'decred',
//     })
//     expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
//   })

//   it('given an ypub, generate p2wpkh-p2sh address and cross verify script pubkey result', () => {
//     const pubkeyP2WPKHP2SH = xpubToPubkey({
//       xpub:
//         'ypub6Wu2Ax4NRoLJW1UCNBRMatwYW5Vr7vqgE4SK6FdKssNEUA2NCor8c5oSdMTUgHT3V9yj1LzMLTJpXwCh7hVenJdfhLB9M6qxmi6bcoFSdVd',
//       network: NetworkEnum.Mainnet,
//       type: BIP43PurposeTypeEnum.WrappedSegwit,
//       bip44ChangeIndex: 0,
//       bip44AddressIndex: 0,
//       coin: 'decred',
//     })
//     const scriptPubkeyP2WPKHP2SH = pubkeyToScriptPubkey({
//       pubkey: pubkeyP2WPKHP2SH,
//       addressType: AddressTypeEnum.p2wpkhp2sh,
//     }).scriptPubkey
//     const p2wpkhp2shAddress = scriptPubkeyToAddress({
//       scriptPubkey: scriptPubkeyP2WPKHP2SH,
//       network: NetworkEnum.Mainnet,
//       addressType: AddressTypeEnum.p2wpkhp2sh,
//       coin: 'decred',
//     })
//     expect(p2wpkhp2shAddress).to.equals('AL8uaqKrP4n61pb2BrQXpMC3VcUdjmpAwn')
//     const scriptPubkeyP2WPKHP2SHRoundTrip = addressToScriptPubkey({
//       address: 'AL8uaqKrP4n61pb2BrQXpMC3VcUdjmpAwn',
//       network: NetworkEnum.Mainnet,
//       addressType: AddressTypeEnum.p2wpkhp2sh,
//       coin: 'decred',
//     })
//     expect(scriptPubkeyP2WPKHP2SHRoundTrip).to.equals(scriptPubkeyP2WPKHP2SH)
//   })

//   it('given a zpub, generate p2wpkh address and cross verify script pubkey result', () => {
//     const pubkeyP2WPKH = xpubToPubkey({
//       xpub:
//         'zpub6sBMnpX8349mvyqk3Y4U1mTJAeCpY4qGNgMeJejYe1sjPYyVVs6qBDrycdTNd7kHXCZBUxuTB9kojxvHKVU6kS9hsoUeekK1QRBU9nDYtx2',
//       network: NetworkEnum.Mainnet,
//       type: BIP43PurposeTypeEnum.Segwit,
//       bip44ChangeIndex: 0,
//       bip44AddressIndex: 0,
//       coin: 'decred',
//     })
//     const scriptPubkeyP2WPKH = pubkeyToScriptPubkey({
//       pubkey: pubkeyP2WPKH,
//       addressType: AddressTypeEnum.p2wpkh,
//     }).scriptPubkey
//     const p2wpkhAddress = scriptPubkeyToAddress({
//       scriptPubkey: scriptPubkeyP2WPKH,
//       network: NetworkEnum.Mainnet,
//       addressType: AddressTypeEnum.p2wpkh,
//       coin: 'decred',
//     })
//     expect(p2wpkhAddress).to.equals(
//       'btg1qkwnu2phwvard2spr2n0a9d84x590ahywl3yacu'
//     )
//     const scriptPubkeyP2WPKHRoundTrip = addressToScriptPubkey({
//       address: 'btg1qkwnu2phwvard2spr2n0a9d84x590ahywl3yacu',
//       network: NetworkEnum.Mainnet,
//       addressType: AddressTypeEnum.p2wpkh,
//       coin: 'decred',
//     })
//     expect(scriptPubkeyP2WPKHRoundTrip).to.be.equal(scriptPubkeyP2WPKH)
//   })
// })

describe('decred from WIF to private key to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'PmQhFGVRUjeRmGBPJCW2FCXFck1EoDBF6hks6auNJVQ26M4h73W9W'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'decred',
    })
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'decred',
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })

  // it('take a wif private key', () => {
  //   console.log('PmQhFGVRUjeRmGBPJCW2FCXFck1EoDBF6hks6auNJVQ26M4h73W9W')
  //   const wifKey = 'PmQhFGVRUjeRmGBPJCW2FCXFck1EoDBF6hks6auNJVQ26M4h73W9W'
  //   const privateKey = wifToPrivateKey({
  //     wifKey,
  //     network: NetworkEnum.Mainnet,
  //     coin: 'decred',
  //   })
  //   const wifKeyRoundTrip = privateKeyToWIF({
  //     privateKey: privateKey,
  //     network: NetworkEnum.Mainnet,
  //     coin: 'decred',
  //   })
  //   expect(wifKey).to.be.equal(wifKeyRoundTrip)
  // })
})

// describe('decred guess script pubkeys from address', () => {
//   // these tests are cross verified with bitcoin core
//   it('p2pkh address to scriptPubkey', () => {
//     const scriptPubkey = addressToScriptPubkey({
//       address: 'GeTZ7bjfXtGsyEcerSSFJNUSZwLfjtCJX9',
//       network: NetworkEnum.Mainnet,
//       coin: 'decred',
//     })
//     expect(scriptPubkey).to.equal(
//       '76a914e21fb547704ff606ba769b9d6d7985f4cca760f788ac'
//     )
//   })
//   it('p2sh address to scriptPubkey', () => {
//     const scriptPubkey = addressToScriptPubkey({
//       address: 'AL8uaqKrP4n61pb2BrQXpMC3VcUdjmpAwn',
//       network: NetworkEnum.Mainnet,
//       coin: 'decred',
//     })
//     expect(scriptPubkey).to.equal(
//       'a9142fdadae8827ecedb668946c073ebbb0482820c6387'
//     )
//   })

//   it('p2wpkh address to scriptPubkey', () => {
//     const scriptPubkey = addressToScriptPubkey({
//       address: 'btg1qkwnu2phwvard2spr2n0a9d84x590ahywl3yacu',
//       network: NetworkEnum.Mainnet,
//       coin: 'decred',
//     })
//     expect(scriptPubkey).to.equal(
//       '0014b3a7c506ee6746d5402354dfd2b4f5350afedc8e'
//     )
//   })
// })
