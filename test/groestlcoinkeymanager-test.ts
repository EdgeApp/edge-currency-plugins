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

// describe('groestlcoin mnemonic to xprv test vectors as compared with iancoleman', () => {
//   const mnemonic =
//     'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
//   it('bip44 mnemonic to xpriv mainnet', () => {
//     const resultLegacy = mnemonicToXPriv({
//       mnemonic: mnemonic,
//       path: "m/44'/17'/0'",
//       network: NetworkEnum.Mainnet,
//       type: BIP43PurposeTypeEnum.Legacy,
//       coin: 'groestlcoin'
//     })
//     expect(resultLegacy).to.equal(
//       'xprv9zG5s8VhyRCaktqFMWHHkaxX1XdgDsD2GjX31daogFTCcer54yTtWroAXRAHZV6GuuiTSUfNheduV4i8rJEJ45QGcCrfKyCwmbD4zaLp9Y7'
//     )
//   })

//   it('bip44 mnemonic to xpriv testnet', () => {
//     const resultLegacyTestnet = mnemonicToXPriv({
//       mnemonic: mnemonic,
//       path: "m/44'/1'/0'",
//       network: NetworkEnum.Testnet,
//       type: BIP43PurposeTypeEnum.Legacy,
//       coin: 'groestlcoin'
//     })
//     expect(resultLegacyTestnet).to.equal(
//       'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
//     )
//   })
// })

// describe('groestlcoin bip32 prefix tests for the conversion from xpriv to xpub', () => {
//   it('bip44 xpriv to xpub mainnet', () => {
//     const resultLegacy = xprivToXPub({
//       xpriv:
//         'xprv9zG5s8VhyRCaktqFMWHHkaxX1XdgDsD2GjX31daogFTCcer54yTtWroAXRAHZV6GuuiTSUfNheduV4i8rJEJ45QGcCrfKyCwmbD4zaLp9Y7',
//       network: NetworkEnum.Mainnet,
//       type: BIP43PurposeTypeEnum.Legacy,
//       coin: 'groestlcoin'
//     })
//     expect(resultLegacy).to.equals(
//       'xpub6DFSGe2bonksyNuiTXpJ7iuFZZUAdKvsdxSdp1zREazBVTBDcWn94f7eNg5MN148WHsaUfG3Mmmqa6nBi1VCde1t7wM3NA3993CcjChk1g5'
//     )
//   })

//   it('bip44 xpriv to xpub testnet', () => {
//     const resultLegacyTestnet = xprivToXPub({
//       xpriv:
//         'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
//       network: NetworkEnum.Testnet,
//       type: BIP43PurposeTypeEnum.Legacy,
//       coin: 'groestlcoin'
//     })
//     expect(resultLegacyTestnet).to.equals(
//       'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
//     )
//   })
// })

// describe('groestlcoin xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
//   /*
//     These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
//     using the same seed as in other tests (abandon, ...)
//     */

//   it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
//     const pubkeyP2PKH = xpubToPubkey({
//       xpub:
//         'xpub6DFSGe2bonksyNuiTXpJ7iuFZZUAdKvsdxSdp1zREazBVTBDcWn94f7eNg5MN148WHsaUfG3Mmmqa6nBi1VCde1t7wM3NA3993CcjChk1g5',
//       network: NetworkEnum.Mainnet,
//       type: BIP43PurposeTypeEnum.Legacy,
//       bip44ChangeIndex: 0,
//       bip44AddressIndex: 0,
//       coin: 'groestlcoin'
//     })
//     const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
//       pubkey: pubkeyP2PKH,
//       addressType: AddressTypeEnum.p2pkh
//     }).scriptPubkey

//     const p2pkhAddress = scriptPubkeyToAddress({
//       scriptPubkey: scriptPubkeyP2PKH,
//       network: NetworkEnum.Mainnet,
//       addressType: AddressTypeEnum.p2pkh,
//       coin: 'groestlcoin'
//     })
//     expect(p2pkhAddress).to.equals('Fpzstx4fKWhqZYbVVmuncuhbEmgecqPTgg')
//     const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
//       address: 'Fpzstx4fKWhqZYbVVmuncuhbEmgecqPTgg',
//       network: NetworkEnum.Mainnet,
//       addressType: AddressTypeEnum.p2pkh,
//       coin: 'groestlcoin'
//     })
//     expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
//   })

//   it('given an ypub, generate p2wpkh-p2sh address and cross verify script pubkey result', () => {
//     const pubkeyP2WPKHP2SH = xpubToPubkey({
//       xpub:
//         'ypub6X46SconPpL9QhXPnMGuPLB9jYai7nrHz7ki4zq3awHb462iPSG5eV19oBWv22RWt69npsi75XGcANsevtTWE8YFgqpygrGUPnEKp6vty5v',
//       network: NetworkEnum.Mainnet,
//       type: BIP43PurposeTypeEnum.WrappedSegwit,
//       bip44ChangeIndex: 0,
//       bip44AddressIndex: 0,
//       coin: 'groestlcoin'
//     })
//     const scriptPubkeyP2WPKHP2SH = pubkeyToScriptPubkey({
//       pubkey: pubkeyP2WPKHP2SH,
//       addressType: AddressTypeEnum.p2wpkhp2sh
//     }).scriptPubkey
//     const p2wpkhp2shAddress = scriptPubkeyToAddress({
//       scriptPubkey: scriptPubkeyP2WPKHP2SH,
//       network: NetworkEnum.Mainnet,
//       addressType: AddressTypeEnum.p2wpkhp2sh,
//       coin: 'groestlcoin'
//     })
//     expect(p2wpkhp2shAddress).to.equals('3299Qf2x9BnzLaZu4HCLvm26RbBB3ZRf4u')
//     const scriptPubkeyP2WPKHP2SHRoundTrip = addressToScriptPubkey({
//       address: '3299Qf2x9BnzLaZu4HCLvm26RbBB3ZRf4u',
//       network: NetworkEnum.Mainnet,
//       addressType: AddressTypeEnum.p2wpkhp2sh,
//       coin: 'groestlcoin'
//     })
//     expect(scriptPubkeyP2WPKHP2SHRoundTrip).to.equals(scriptPubkeyP2WPKHP2SH)
//   })

//   it('given a zpub, generate p2wpkh address and cross verify script pubkey result', () => {
//     const pubkeyP2WPKH = xpubToPubkey({
//       xpub:
//         'zpub6qdhcNVVLJ2t8kLzGLzeaiJv7EahaRBsXmu1yVPyXHvMdFmS4d7JSi5aS6mc1oz5k6DZN781Ffn3GAs3r2FJnCPSw5nti63s3c9EDg2u7MS',
//       network: NetworkEnum.Mainnet,
//       type: BIP43PurposeTypeEnum.Segwit,
//       bip44ChangeIndex: 0,
//       bip44AddressIndex: 0,
//       coin: 'groestlcoin'
//     })
//     const scriptPubkeyP2WPKH = pubkeyToScriptPubkey({
//       pubkey: pubkeyP2WPKH,
//       addressType: AddressTypeEnum.p2wpkh
//     }).scriptPubkey
//     const p2wpkhAddress = scriptPubkeyToAddress({
//       scriptPubkey: scriptPubkeyP2WPKH,
//       network: NetworkEnum.Mainnet,
//       addressType: AddressTypeEnum.p2wpkh,
//       coin: 'groestlcoin'
//     })
//     expect(p2wpkhAddress).to.equals(
//       'grs1qrm2uggqj846nljryvmuga56vtwfey0dtnc4z55'
//     )
//     const scriptPubkeyP2WPKHRoundTrip = addressToScriptPubkey({
//       address: 'grs1qrm2uggqj846nljryvmuga56vtwfey0dtnc4z55',
//       network: NetworkEnum.Mainnet,
//       addressType: AddressTypeEnum.p2wpkh,
//       coin: 'groestlcoin'
//     })
//     expect(scriptPubkeyP2WPKHRoundTrip).to.be.equal(scriptPubkeyP2WPKH)
//   })
// })

// describe('groestlcoin from WIF to private key to WIF', () => {
//   it('take a wif private key', () => {
//     const wifKey = 'KyeNA49yfj4JDoMEWtpQiosP6eig55att3cTv6NBXCeFNsHoNnyM'
//     const privateKey = wifToPrivateKey({
//       wifKey,
//       network: NetworkEnum.Mainnet,
//       coin: 'groestlcoin'
//     })
//     const wifKeyRoundTrip = privateKeyToWIF({
//       privateKey: privateKey,
//       network: NetworkEnum.Mainnet,
//       coin: 'groestlcoin'
//     })
//     expect(wifKey).to.be.equal(wifKeyRoundTrip)
//   })
// })

// describe('groestlcoin guess script pubkeys from address', () => {
//   // these tests are cross verified with bitcoin core
//   it('p2pkh address to scriptPubkey', () => {
//     const scriptPubkey = addressToScriptPubkey({
//       address: 'Fpzstx4fKWhqZYbVVmuncuhbEmgecqPTgg',
//       network: NetworkEnum.Mainnet,
//       coin: 'groestlcoin'
//     })
//     expect(scriptPubkey).to.equal(
//       '76a91477310b27af676f9663881f649860a327d28777be88ac'
//     )
//   })
//   it('p2sh address to scriptPubkey', () => {
//     const scriptPubkey = addressToScriptPubkey({
//       address: '3299Qf2x9BnzLaZu4HCLvm26RbBB3ZRf4u',
//       network: NetworkEnum.Mainnet,
//       coin: 'groestlcoin'
//     })
//     expect(scriptPubkey).to.equal(
//       'a9141f3fe4a26b7d41be615d020c177c20882a2d95d287'
//     )
//   })

//   it('p2wpkh address to scriptPubkey', () => {
//     const scriptPubkey = addressToScriptPubkey({
//       address: 'grs1qrm2uggqj846nljryvmuga56vtwfey0dtnc4z55',
//       network: NetworkEnum.Mainnet,
//       coin: 'groestlcoin'
//     })
//     expect(scriptPubkey).to.equal(
//       '00141ed5c420123d753fc86466f88ed34c5b93923dab'
//     )
//   })
// })
