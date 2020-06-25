import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  BIP43PurposeTypeEnum,
  mnemonicToXPriv,
  NetworkEnum
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
