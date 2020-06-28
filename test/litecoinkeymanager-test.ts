import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  addressToScriptHash,
  AddressTypeEnum,
  BIP43PurposeTypeEnum,
  mnemonicToXPriv,
  NetworkEnum,
  scriptHashToAddress,
  xprivToXPub,
  xpubToScriptHash
} from '../src/utxobased/keymanager/keymanager'

describe('litecoin mnemonic to xprv test vectors as collected from BIP84, BIP49 and some generated cases to test xpub prefix bytes', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip84 mnemonic to xpriv mainnet', () => {
    const resultSegwit = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/84'/2'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Segwit,
      coin: 'litecoin'
    })
    expect(resultSegwit).to.equal(
      'zprvAdQSgFiAHcXKb1gcktyukXyGZykTBemmPZ9brfYnxqxM2CocMdxy9aPXTbTLv7dvJgWn2Efi4vFSyPbT4QqgarYrs583WCeMXM2q3TUU8FS'
    )
  })

  it('bip84 mnemonic to xpriv testnet', () => {
    const resultSegwitTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/84'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Segwit,
      coin: 'litecoin'
    })
    expect(resultSegwitTestnet).to.equal(
      'vprv9K7GLAaERuM58PVvbk1sMo7wzVCoPwzZpVXLRBmum93gL5pSqQCAAvZjtmz93nnnYMr9i2FwG2fqrwYLRgJmDDwFjGiamGsbRMJ5Y6siJ8H'
    )
  })

  it('bip49 mnemonic to xpriv mainnet', () => {
    const resultWrappedSegwit = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/49'/2'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      coin: 'litecoin'
    })
    expect(resultWrappedSegwit).to.equal(
      'Mtpv7RooeEQDUitupgpJcxZnfDwvq8hC24R7GAiscrqFhHHhit96vCNY7yudJgrM841dMbiRUQceC12566XAHHC8Rd1BtnBdokq9tmF7jLLvUdh'
    )
  })

  it('bip49 mnemonic to xpriv testnet', () => {
    const resultWrappedSegwitTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/49'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      coin: 'litecoin'
    })
    expect(resultWrappedSegwitTestnet).to.equal(
      'uprv91G7gZkzehuMVxDJTYE6tLivdF8e4rvzSu1LFfKw3b2Qx1Aj8vpoFnHdfUZ3hmi9jsvPifmZ24RTN2KhwB8BfMLTVqaBReibyaFFcTP1s9n'
    )
  })

  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/2'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'litecoin'
    })
    expect(resultLegacy).to.equal(
      'Ltpv7735AbcbmL1gbgDWj2ezvs59rh4RM1oTN2BKTKbfe3146FCPCNFbBBSWfuV9vCJNMXD9LuHpQnqVWpn2hbMhikqPdoGqbS3ptdPoNWEvvgR'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'litecoin'
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('litecoin bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip84 xpriv to xpub mainnet', () => {
    const resultSegwit = xprivToXPub({
      xpriv:
        'zprvAdQSgFiAHcXKb1gcktyukXyGZykTBemmPZ9brfYnxqxM2CocMdxy9aPXTbTLv7dvJgWn2Efi4vFSyPbT4QqgarYrs583WCeMXM2q3TUU8FS',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Segwit,
      coin: 'litecoin'
    })
    expect(resultSegwit).to.equals(
      'zpub6rPo5mF47z5coVm5rvWv7fv181awb7Vckn5Cf3xQXBVKu18kuBHDhNi1Jrb4br6vVD3ZbrnXemEsWJoR18mZwkUdzwD8TQnHDUCGxqZ6swA'
    )
  })

  it('bip84 xpriv to xpub mainnet', () => {
    const resultSegwitTestnet = xprivToXPub({
      xpriv:
        'vprv9K7GLAaERuM58PVvbk1sMo7wzVCoPwzZpVXLRBmum93gL5pSqQCAAvZjtmz93nnnYMr9i2FwG2fqrwYLRgJmDDwFjGiamGsbRMJ5Y6siJ8H',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Segwit,
      coin: 'litecoin'
    })
    expect(resultSegwitTestnet).to.equals(
      'vpub5Y6cjg78GGuNLsaPhmYsiw4gYX3HoQiRBiSwDaBXKUafCt9bNwWQiitDk5VZ5BVxYnQdwoTyXSs2JHRPAgjAvtbBrf8ZhDYe2jWAqvZVnsc'
    )
  })

  it('bip49 xpriv to xpub mainnet', () => {
    const resultWrappedSegwit = xprivToXPub({
      xpriv:
        'Mtpv7RooeEQDUitupgpJcxZnfDwvq8hC24R7GAiscrqFhHHhit96vCNY7yudJgrM841dMbiRUQceC12566XAHHC8Rd1BtnBdokq9tmF7jLLvUdh',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      coin: 'litecoin'
    })
    expect(resultWrappedSegwit).to.equals(
      'Mtub2rz9F1pkisRsSZX8sa4Ajon9GhPP6JymLgpuHqbYdU5JKFLBF7Qy8b1tZ3dccj2fefrAxfrPdVkpCxuWn3g72UctH2bvJRkp6iFmp8aLeRZ'
    )
  })

  it('bip49 xpriv to xpub testnet', () => {
    const resultWrappedSegwitTestnet = xprivToXPub({
      xpriv:
        'uprv91G7gZkzehuMVxDJTYE6tLivdF8e4rvzSu1LFfKw3b2Qx1Aj8vpoFnHdfUZ3hmi9jsvPifmZ24RTN2KhwB8BfMLTVqaBReibyaFFcTP1s9n',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      coin: 'litecoin'
    })
    expect(resultWrappedSegwitTestnet).to.equals(
      'upub5EFU65HtV5TeiSHmZZm7FUffBGy8UKeqp7vw43jYbvZPpoVsgU93oac7Wk3u6moKegAEWtGNF8DehrnHtv21XXEMYRUocHqguyjknFHYfgY'
    )
  })

  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'Ltpv7735AbcbmL1gbgDWj2ezvs59rh4RM1oTN2BKTKbfe3146FCPCNFbBBSWfuV9vCJNMXD9LuHpQnqVWpn2hbMhikqPdoGqbS3ptdPoNWEvvgR',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'litecoin'
    })
    expect(resultLegacy).to.equals(
      'Ltub2YDQmP391UYeDYvLye9P1SuNJFkcRGN7SYHM8JMxaDnegcPTXHJ2BnYmvHnFnGPGKu2WMuCga6iZV3SDxDMGrRyMcrYEfSPhrpS1EPkC43E'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fVU32aAEuEPeH1WYx3LhXtSFZTRaFqjbFNPaJZ9R8fCVja44tSaUPZEKGpMK6McUDkWWMvRiVfKR3Wzei6AmLoTNYHMAZ9KtvVTLZZdhvA',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'litecoin'
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDCBWBScQPGv4Xk3JSbhw6wYYpayMjb2eAYyArpbSqQTbLDpphHGAetB6VQgVeftLML8vDSUEWcC2xDi3qJJ3YCDChJDvqVzpgoYSuT52MhJ'
    )
  })
})

describe('bitcoin xpub to address tests;  generate valid addresses by calling xpubToScriptHash and scriptHashToAddress', () => {
  /*
  These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
  using the same seed as in other tests (abandon, ...)
  */

  it('given an xpub, generate p2pkh address and cross verify scriptHash (pubkey hash) result', () => {
    const scriptHashP2PKH = xpubToScriptHash({
      xpub:
        'Ltub2YDQmP391UYeDYvLye9P1SuNJFkcRGN7SYHM8JMxaDnegcPTXHJ2BnYmvHnFnGPGKu2WMuCga6iZV3SDxDMGrRyMcrYEfSPhrpS1EPkC43E',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      addressType: AddressTypeEnum.p2pkh,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'litecoin'
    }).scriptHash
    const p2pkhAddress = scriptHashToAddress({
      scriptHash: scriptHashP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'litecoin'
    })
    expect(p2pkhAddress).to.equals('LUWPbpM43E2p7ZSh8cyTBEkvpHmr3cB8Ez')
    const scriptHashP2PKHRoundTrip = addressToScriptHash({
      address: 'LUWPbpM43E2p7ZSh8cyTBEkvpHmr3cB8Ez',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'litecoin'
    })
    // TODO: Drop this string comparison and use equals bytes instead
    expect(scriptHashP2PKHRoundTrip?.toString()).to.equals(
      scriptHashP2PKH?.toString()
    )
  })

  it('given an ypub, generate p2wpkh-p2sh address and cross-verify scriptHash result', () => {
    const scriptHashP2WPKHP2SH = xpubToScriptHash({
      xpub:
        'Mtub2rz9F1pkisRsSZX8sa4Ajon9GhPP6JymLgpuHqbYdU5JKFLBF7Qy8b1tZ3dccj2fefrAxfrPdVkpCxuWn3g72UctH2bvJRkp6iFmp8aLeRZ',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      addressType: AddressTypeEnum.p2wpkhp2sh,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'litecoin'
    }).scriptHash
    const p2wpkhp2shAddress = scriptHashToAddress({
      scriptHash: scriptHashP2WPKHP2SH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkhp2sh,
      coin: 'litecoin'
    })
    expect(p2wpkhp2shAddress).to.equals('M7wtsL7wSHDBJVMWWhtQfTMSYYkyooAAXM')
    const scriptHashP2WPKHP2SHRoundTrip = addressToScriptHash({
      address: 'M7wtsL7wSHDBJVMWWhtQfTMSYYkyooAAXM',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkhp2sh,
      coin: 'litecoin'
    })
    expect(scriptHashP2WPKHP2SHRoundTrip?.toString()).to.equals(
      scriptHashP2WPKHP2SH?.toString()
    )
  })

  it('bitcoin given a zpub, generate p2wpkh address and cross verify scriptHash (pubkey hash) result', () => {
    const scriptHashP2WPKH = xpubToScriptHash({
      xpub:
        'zpub6rPo5mF47z5coVm5rvWv7fv181awb7Vckn5Cf3xQXBVKu18kuBHDhNi1Jrb4br6vVD3ZbrnXemEsWJoR18mZwkUdzwD8TQnHDUCGxqZ6swA',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Segwit,
      addressType: AddressTypeEnum.p2wpkh,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'litecoin'
    }).scriptHash
    const p2wpkhAddress = scriptHashToAddress({
      scriptHash: scriptHashP2WPKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'litecoin'
    })
    expect(p2wpkhAddress).to.equals(
      'ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh'
    )
    const scriptHashP2WPKHRoundTrip = addressToScriptHash({
      address: 'ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'litecoin'
    })
    expect(scriptHashP2WPKHRoundTrip?.toString()).to.be.equal(
      scriptHashP2WPKH?.toString()
    )
  })
})
