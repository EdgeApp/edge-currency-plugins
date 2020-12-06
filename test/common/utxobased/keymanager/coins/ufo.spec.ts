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
} from '../../../../../src/common/utxobased/keymanager/keymanager'

describe('uniformfiscalobject mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/202'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'uniformfiscalobject',
    })
    expect(resultLegacy).to.equal(
      'xprv9ytsf7bk77SoYKsJAvqg3sB9gLDp54YHT8bditZW7L5Y6o914va5v6XwZcf6DAuJ4nAbJAxrtwZo8b1jA9ozd73zBz2pTT1ic533idtEwtJ'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'uniformfiscalobject',
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('uniformfiscalobject bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'xprv9ytsf7bk77SoYKsJAvqg3sB9gLDp54YHT8bditZW7L5Y6o914va5v6XwZcf6DAuJ4nAbJAxrtwZo8b1jA9ozd73zBz2pTT1ic533idtEwtJ',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'uniformfiscalobject',
    })
    expect(resultLegacy).to.equals(
      'xpub6CtE4d8dwV16kowmGxNgR17tEN4JUXG8pMXEXGy7ffcWybU9cTtLTtrRQsDwHkMADcjoXSNeoebv5XAGJg6n7Zh9vz5TWWvUJzKTSdeUFHn'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'uniformfiscalobject',
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
    )
  })
})

describe('uniformfiscalobject xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
  /*
    These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
    using the same seed as in other tests (abandon, ...)
    */

  it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'xpub6CtE4d8dwV16kowmGxNgR17tEN4JUXG8pMXEXGy7ffcWybU9cTtLTtrRQsDwHkMADcjoXSNeoebv5XAGJg6n7Zh9vz5TWWvUJzKTSdeUFHn',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      changeIndex: 0,
      addressIndex: 0,
      coin: 'uniformfiscalobject',
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      scriptType: ScriptTypeEnum.p2pkh,
    }).scriptPubkey

    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'uniformfiscalobject',
    })
    expect(p2pkhAddress).to.equals('C3mUHE7dpemNsGoa4rahQoEworx5DkbnFA')
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: 'C3mUHE7dpemNsGoa4rahQoEworx5DkbnFA',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'uniformfiscalobject',
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })

  it('given an ypub, generate p2wpkh-p2sh address and cross verify script pubkey result', () => {
    const pubkeyP2WPKHP2SH = xpubToPubkey({
      xpub:
        'ypub6Wu2Ax4NRoLJW1UCNBRMatwYW5Vr7vqgE4SK6FdKssNEUA2NCor8c5oSdMTUgHT3V9yj1LzMLTJpXwCh7hVenJdfhLB9M6qxmi6bcoFSdVd',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      changeIndex: 0,
      addressIndex: 0,
      coin: 'uniformfiscalobject',
    })
    const scriptPubkeyP2WPKHP2SH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2WPKHP2SH,
      scriptType: ScriptTypeEnum.p2wpkhp2sh,
    }).scriptPubkey
    const p2wpkhp2shAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2WPKHP2SH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2sh,
      coin: 'uniformfiscalobject',
    })
    expect(p2wpkhp2shAddress).to.equals('USM3tijpLBdWpKrvHjPsdzSSpK55k9V79A')
    const scriptPubkeyP2WPKHP2SHRoundTrip = addressToScriptPubkey({
      address: 'USM3tijpLBdWpKrvHjPsdzSSpK55k9V79A',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2sh,
      coin: 'uniformfiscalobject',
    })
    expect(scriptPubkeyP2WPKHP2SHRoundTrip).to.equals(scriptPubkeyP2WPKHP2SH)
  })

  it('given a zpub, generate p2wpkh address and cross verify script pubkey result', () => {
    const pubkeyP2WPKH = xpubToPubkey({
      xpub:
        'zpub6sBMnpX8349mvyqk3Y4U1mTJAeCpY4qGNgMeJejYe1sjPYyVVs6qBDrycdTNd7kHXCZBUxuTB9kojxvHKVU6kS9hsoUeekK1QRBU9nDYtx2',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Segwit,
      changeIndex: 0,
      addressIndex: 0,
      coin: 'uniformfiscalobject',
    })
    const scriptPubkeyP2WPKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2WPKH,
      scriptType: ScriptTypeEnum.p2wpkh,
    }).scriptPubkey
    const p2wpkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2WPKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'uniformfiscalobject',
    })
    expect(p2wpkhAddress).to.equals(
      'uf1qkwnu2phwvard2spr2n0a9d84x590ahywqd6hp9'
    )
    const scriptPubkeyP2WPKHRoundTrip = addressToScriptPubkey({
      address: 'uf1qkwnu2phwvard2spr2n0a9d84x590ahywqd6hp9',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'uniformfiscalobject',
    })
    expect(scriptPubkeyP2WPKHRoundTrip).to.be.equal(scriptPubkeyP2WPKH)
  })
})

// describe('uniformfiscalobject from WIF to private key to WIF', () => {
//   it('take a wif private key', () => {
//     const wifKey = 'L4gU3tKvsS3XQ5eJXDARFEnMyoCvE8vsoYBngMAJESexY5yHsdkJ'
//     const privateKey = wifToPrivateKey({
//       wifKey,
//       network: NetworkEnum.Mainnet,
//       coin: 'uniformfiscalobject'
//     })
//     const wifKeyRoundTrip = privateKeyToWIF({
//       privateKey: privateKey,
//       network: NetworkEnum.Mainnet,
//       coin: 'uniformfiscalobject'
//     })
//     expect(wifKey).to.be.equal(wifKeyRoundTrip)
//   })
// })

describe('uniformfiscalobject guess script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'C3mUHE7dpemNsGoa4rahQoEworx5DkbnFA',
      network: NetworkEnum.Mainnet,
      coin: 'uniformfiscalobject',
    })
    expect(scriptPubkey).to.equal(
      '76a91474b99370640b77b9ad609c90017fea39dbda907888ac'
    )
  })
  it('p2sh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'C3mUHE7dpemNsGoa4rahQoEworx5DkbnFA',
      network: NetworkEnum.Mainnet,
      coin: 'uniformfiscalobject',
    })
    expect(scriptPubkey).to.equal(
      '76a91474b99370640b77b9ad609c90017fea39dbda907888ac'
    )
  })

  it('p2wpkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'uf1qkwnu2phwvard2spr2n0a9d84x590ahywqd6hp9',
      network: NetworkEnum.Mainnet,
      coin: 'uniformfiscalobject',
    })
    expect(scriptPubkey).to.equal(
      '0014b3a7c506ee6746d5402354dfd2b4f5350afedc8e'
    )
  })
})

describe('uniformfiscalobject from WIF to private key to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'Q2paQ28ajBabp1xuCqmjP7HdeuGSK2vVNaEvrVgLiqP9qYHYFrtL'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'uniformfiscalobject',
    })
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'uniformfiscalobject',
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })
})
