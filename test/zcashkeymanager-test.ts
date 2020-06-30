// import { expect } from 'chai'
// import { describe, it } from 'mocha'

// import {
//   addressToScriptPubkey,
//   AddressTypeEnum,
//   BIP43PurposeTypeEnum,
//   mnemonicToXPriv,
//   NetworkEnum,
//   privateKeyToWIF,
//   pubkeyToScriptPubkey,
//   scriptPubkeyToAddress,
//   wifToPrivateKey,
//   xprivToXPub,
//   xpubToPubkey
// } from '../src/common/utxobased/keymanager/keymanager'

// describe('zcash mnemonic to xprv test vectors as compared with iancoleman', () => {
//   const mnemonic =
//     'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
//   it('bip44 mnemonic to xpriv mainnet', () => {
//     const resultLegacy = mnemonicToXPriv({
//       mnemonic: mnemonic,
//       path: "m/44'/133'/0'",
//       network: NetworkEnum.Mainnet,
//       type: BIP43PurposeTypeEnum.Legacy,
//       coin: 'zcash'
//     })
//     expect(resultLegacy).to.equal(
//       'xprv9yMAh5zLARRVxiM7BXEzJ2t6WbW7dbm8G765ctzqhjYqW9GAtei2NjQyYmDsoVoWxTdfY5D1uDAm58bcTb35GHTxKRCVzpv42SfuxTfPTCm'
//     )
//   })

//   it('bip44 mnemonic to xpriv testnet', () => {
//     const resultLegacyTestnet = mnemonicToXPriv({
//       mnemonic: mnemonic,
//       path: "m/44'/1'/0'",
//       network: NetworkEnum.Testnet,
//       type: BIP43PurposeTypeEnum.Legacy,
//       coin: 'zcash'
//     })
//     expect(resultLegacyTestnet).to.equal(
//       'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
//     )
//   })
// })

// describe('zcash bip32 prefix tests for the conversion from xpriv to xpub', () => {
//   it('bip44 xpriv to xpub mainnet', () => {
//     const resultLegacy = xprivToXPub({
//       xpriv:
//         'xprv9yMAh5zLARRVxiM7BXEzJ2t6WbW7dbm8G765ctzqhjYqW9GAtei2NjQyYmDsoVoWxTdfY5D1uDAm58bcTb35GHTxKRCVzpv42SfuxTfPTCm',
//       network: NetworkEnum.Mainnet,
//       type: BIP43PurposeTypeEnum.Legacy,
//       coin: 'zcash'
//     })
//     expect(resultLegacy).to.equals(
//       'xpub6CLX6bXDznyoBCRaHYmzfApq4dLc34UydL1gRHQTG55pNwbKSC2GvXjTQ4VS3n6P24fRd14uKz7P92xJQ3MWdRzUxGkqiftZf3riboiJLJs'
//     )
//   })

//   it('bip44 xpriv to xpub testnet', () => {
//     const resultLegacyTestnet = xprivToXPub({
//       xpriv:
//         'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
//       network: NetworkEnum.Testnet,
//       type: BIP43PurposeTypeEnum.Legacy,
//       coin: 'zcash'
//     })
//     expect(resultLegacyTestnet).to.equals(
//       'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
//     )
//   })
// })

// describe('zcash xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
//   /*
//     These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
//     using the same seed as in other tests (abandon, ...)
//     */

//   it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
//     const pubkeyP2PKH = xpubToPubkey({
//       xpub:
//         'xpub6CLX6bXDznyoBCRaHYmzfApq4dLc34UydL1gRHQTG55pNwbKSC2GvXjTQ4VS3n6P24fRd14uKz7P92xJQ3MWdRzUxGkqiftZf3riboiJLJs',
//       network: NetworkEnum.Mainnet,
//       type: BIP43PurposeTypeEnum.Legacy,
//       bip44ChangeIndex: 0,
//       bip44AddressIndex: 0,
//       coin: 'zcash'
//     })
//     const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
//       pubkey: pubkeyP2PKH,
//       addressType: AddressTypeEnum.p2pkh
//     }).scriptPubkey

//     const p2pkhAddress = scriptPubkeyToAddress({
//       scriptPubkey: scriptPubkeyP2PKH,
//       network: NetworkEnum.Mainnet,
//       addressType: AddressTypeEnum.p2pkh,
//       coin: 'zcash'
//     })
//     expect(p2pkhAddress).to.equals('t1XVXWCvpMgBvUaed4XDqWtgQgJSu1Ghz7F')
//     const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
//       address: 't1XVXWCvpMgBvUaed4XDqWtgQgJSu1Ghz7F',
//       network: NetworkEnum.Mainnet,
//       addressType: AddressTypeEnum.p2pkh,
//       coin: 'zcash'
//     })
//     expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
//   })
// })

// describe('zcash from WIF to private key to WIF', () => {
//   it('take a wif private key', () => {
//     const wifKey = 'KxU83MzcLXP1WJtoFJXMDMcN3z5ykAa9xLdFTDY5XpV4e6Zit9BA'
//     const privateKey = wifToPrivateKey({
//       wifKey,
//       network: NetworkEnum.Mainnet,
//       coin: 'zcash'
//     })
//     const wifKeyRoundTrip = privateKeyToWIF({
//       privateKey: privateKey,
//       network: NetworkEnum.Mainnet,
//       coin: 'zcash'
//     })
//     expect(wifKey).to.be.equal(wifKeyRoundTrip)
//   })
// })

// describe('zcash guess script pubkeys from address', () => {
//   // these tests are cross verified with bitcoin core
//   it('p2pkh address to scriptPubkey', () => {
//     const scriptPubkey = addressToScriptPubkey({
//       address: '1K6LZdwpKT5XkEZo2T2kW197aMXYbYMc4f',
//       network: NetworkEnum.Mainnet,
//       coin: 'zcash'
//     })
//     expect(scriptPubkey).to.equal(
//       '76a914c674ac8e0534044717c9ee450d5d9f25e243645088ac'
//     )
//   })
// })
