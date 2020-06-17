import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  addressToScriptHash,
  addressToScriptPubkey,
  AddressTypeEnum,
  BIP43PurposeTypeEnum,
  createTx,
  mnemonicToXPriv,
  NetworkEnum,
  pubkeyToScriptPubkey,
  scriptHashToAddress,
  TransactionInputTypeEnum,
  wifToECPair,
  xprivToXPub,
  xpubToScriptHash
} from '../src/index'

describe('mnemonic to xprv tests', () => {
  it('bip32 test vectors as collected from BIP84, BIP49 and some generated cases to test xpub prefix bytes', () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
    const resultSegwit = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/84'/0'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Segwit
    })
    expect(resultSegwit).to.equal(
      'zprvAdG4iTXWBoARxkkzNpNh8r6Qag3irQB8PzEMkAFeTRXxHpbF9z4QgEvBRmfvqWvGp42t42nvgGpNgYSJA9iefm1yYNZKEm7z6qUWCroSQnE'
    )

    const resultSegwitTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/84'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Segwit
    })
    expect(resultSegwitTestnet).to.equal(
      'vprv9K7GLAaERuM58PVvbk1sMo7wzVCoPwzZpVXLRBmum93gL5pSqQCAAvZjtmz93nnnYMr9i2FwG2fqrwYLRgJmDDwFjGiamGsbRMJ5Y6siJ8H'
    )

    const resultWrappedSegwit = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/49'/0'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit
    })
    expect(resultWrappedSegwit).to.equal(
      'yprvAHwhK6RbpuS3dgCYHM5jc2ZvEKd7Bi61u9FVhYMpgMSuZS613T1xxQeKTffhrHY79hZ5PsskBjcc6C2V7DrnsMsNaGDaWev3GLRQRgV7hxF'
    )

    const resultWrappedSegwitTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/49'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit
    })
    expect(resultWrappedSegwitTestnet).to.equal(
      'uprv91G7gZkzehuMVxDJTYE6tLivdF8e4rvzSu1LFfKw3b2Qx1Aj8vpoFnHdfUZ3hmi9jsvPifmZ24RTN2KhwB8BfMLTVqaBReibyaFFcTP1s9n'
    )

    const resultLegacy = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/0'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy
    })
    expect(resultLegacy).to.equal(
      'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb'
    )

    const resultLegacyTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/0'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fVU32aAEuEPeH1WYx3LhXtSFZTRaFqjbFNPaJZ9R8fCVja44tSaUPZEKGpMK6McUDkWWMvRiVfKR3Wzei6AmLoTNYHMAZ9KtvVTLZZdhvA'
    )
  })
})

describe('xpriv to xpub tests', () => {
  it('bip32 prefix tests for the conversion from xpriv to xpub', () => {
    const resultSegwit = xprivToXPub({
      xpriv:
        'zprvAdG4iTXWBoARxkkzNpNh8r6Qag3irQB8PzEMkAFeTRXxHpbF9z4QgEvBRmfvqWvGp42t42nvgGpNgYSJA9iefm1yYNZKEm7z6qUWCroSQnE',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Segwit
    })
    expect(resultSegwit).to.equals(
      'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs'
    )

    const resultSegwitTestnet = xprivToXPub({
      xpriv:
        'vprv9K7GLAaERuM58PVvbk1sMo7wzVCoPwzZpVXLRBmum93gL5pSqQCAAvZjtmz93nnnYMr9i2FwG2fqrwYLRgJmDDwFjGiamGsbRMJ5Y6siJ8H',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Segwit
    })
    expect(resultSegwitTestnet).to.equals(
      'vpub5Y6cjg78GGuNLsaPhmYsiw4gYX3HoQiRBiSwDaBXKUafCt9bNwWQiitDk5VZ5BVxYnQdwoTyXSs2JHRPAgjAvtbBrf8ZhDYe2jWAqvZVnsc'
    )

    const resultWrappedSegwit = xprivToXPub({
      xpriv:
        'yprvAHwhK6RbpuS3dgCYHM5jc2ZvEKd7Bi61u9FVhYMpgMSuZS613T1xxQeKTffhrHY79hZ5PsskBjcc6C2V7DrnsMsNaGDaWev3GLRQRgV7hxF',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit
    })
    expect(resultWrappedSegwit).to.equals(
      'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP'
    )

    const resultWrappedSegwitTestnet = xprivToXPub({
      xpriv:
        'uprv91G7gZkzehuMVxDJTYE6tLivdF8e4rvzSu1LFfKw3b2Qx1Aj8vpoFnHdfUZ3hmi9jsvPifmZ24RTN2KhwB8BfMLTVqaBReibyaFFcTP1s9n',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit
    })
    expect(resultWrappedSegwitTestnet).to.equals(
      'upub5EFU65HtV5TeiSHmZZm7FUffBGy8UKeqp7vw43jYbvZPpoVsgU93oac7Wk3u6moKegAEWtGNF8DehrnHtv21XXEMYRUocHqguyjknFHYfgY'
    )

    const resultLegacy = xprivToXPub({
      xpriv:
        'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy
    })
    expect(resultLegacy).to.equals(
      'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj'
    )

    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fVU32aAEuEPeH1WYx3LhXtSFZTRaFqjbFNPaJZ9R8fCVja44tSaUPZEKGpMK6McUDkWWMvRiVfKR3Wzei6AmLoTNYHMAZ9KtvVTLZZdhvA',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDCBWBScQPGv4Xk3JSbhw6wYYpayMjb2eAYyArpbSqQTbLDpphHGAetB6VQgVeftLML8vDSUEWcC2xDi3qJJ3YCDChJDvqVzpgoYSuT52MhJ'
    )
  })
})

describe('xpub to address tests', () => {
  it('given different xpubs, generate a valid address by calling xpubToScriptHash and scriptHashToAddress', () => {
    /*
    These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
    using the same seed as in other tests (abandon, ...)
    */

    const scriptHashP2PKH = xpubToScriptHash({
      xpub:
        'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      addressType: AddressTypeEnum.p2pkh,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0
    })
    const p2pkhAddress = scriptHashToAddress({
      scriptHash: scriptHashP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh
    })
    expect(p2pkhAddress).to.equals('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA')
    const scriptHashP2PKHRoundTrip = addressToScriptHash({
      address: '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh
    })
    // TODO: Drop this string comparison and use equals bytes instead
    expect(scriptHashP2PKHRoundTrip?.toString()).to.equals(
      scriptHashP2PKH?.toString()
    )

    const scriptHashP2SH = xpubToScriptHash({
      xpub:
        'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      addressType: AddressTypeEnum.p2sh,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0
    })
    const p2shAddress = scriptHashToAddress({
      scriptHash: scriptHashP2SH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2sh
    })
    expect(p2shAddress).to.equals('3Hggo5JYqytA5k5As5XuADi6TYGQmMZrND')
    const scriptHashP2SHRoundTrip = addressToScriptHash({
      address: '3Hggo5JYqytA5k5As5XuADi6TYGQmMZrND',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2sh
    })
    expect(scriptHashP2SHRoundTrip?.toString()).to.equals(
      scriptHashP2SH?.toString()
    )

    const scriptHashP2WPKHP2SH = xpubToScriptHash({
      xpub:
        'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      addressType: AddressTypeEnum.p2wpkhp2sh,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0
    })
    const p2wpkhp2shAddress = scriptHashToAddress({
      scriptHash: scriptHashP2WPKHP2SH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkhp2sh
    })
    expect(p2wpkhp2shAddress).to.equals('37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf')
    const scriptHashP2WPKHP2SHRoundTrip = addressToScriptHash({
      address: '37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkhp2sh
    })
    expect(scriptHashP2WPKHP2SHRoundTrip?.toString()).to.equals(
      scriptHashP2WPKHP2SH?.toString()
    )

    const scriptHashP2WPKH = xpubToScriptHash({
      xpub:
        'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Segwit,
      addressType: AddressTypeEnum.p2wpkh,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0
    })
    const p2wpkhAddress = scriptHashToAddress({
      scriptHash: scriptHashP2WPKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh
    })
    expect(p2wpkhAddress).to.equals(
      'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu'
    )
    const scriptHashP2WPKHRoundTrip = addressToScriptHash({
      address: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh
    })
    expect(scriptHashP2WPKHRoundTrip?.toString()).to.be.equal(
      scriptHashP2WPKH?.toString()
    )
  })
})

describe('transaction creation and signing test', () => {
  // key with control on the unspent output and used to sign the transaction
  const wifKey = 'L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr'
  const ecKeyPair = wifToECPair({ wifKey })
  const scriptPubkey = pubkeyToScriptPubkey({
    pubkey: ecKeyPair.publicKey,
    addressType: AddressTypeEnum.p2pkh
  })
  it('Create transaction with one legacy input and one output', () => {
    const hexTx: string = createTx({
      network: NetworkEnum.Mainnet,
      inputs: [
        {
          type: TransactionInputTypeEnum.Legacy,
          prev_txid:
            '7d067b4a697a09d2c3cff7d4d9506c9955e93bff41bf82d439da7d030382bc3e',
          // prev_tx only for non segwit inputs
          prev_txout: Buffer.from(
            '0200000001f9f34e95b9d5c8abcd20fc5bd4a825d1517be62f0f775e5f36da944d9' +
              '452e550000000006b483045022100c86e9a111afc90f64b4904bd609e9eaed80d48' +
              'ca17c162b1aca0a788ac3526f002207bb79b60d4fc6526329bf18a77135dc566020' +
              '9e761da46e1c2f1152ec013215801210211755115eabf846720f5cb18f248666fec' +
              '631e5e1e66009ce3710ceea5b1ad13ffffffff01' +
              // value in satoshis (Int64LE) = 0x015f90 = 90000
              '905f010000000000' +
              // scriptPubkey length
              '19' +
              // scriptPubkey
              scriptPubkey.toString('hex') +
              // locktime
              '00000000',
            'hex'
          ),
          index: 0,
          // prev_scriptPubkey only relevant for Segwit inputs, but keep mandator for now before we start handling errors.
          prev_scriptPubkey: scriptPubkey,
          sequence: 0xffffffff
        }
      ],
      outputs: [
        {
          scriptPubkey: addressToScriptPubkey({
            address: '1KRMKfeZcmosxALVYESdPNez1AP1mEtywp',
            network: NetworkEnum.Mainnet,
            addressType: AddressTypeEnum.p2pkh
          }),
          amount: 8000
        }
      ],
      locktime: 0,
      privateKey: ecKeyPair
    })
    expect(hexTx).to.equal(
      '02000000013ebc8203037dda39d482bf41ff3be955996c50d9d4f7cfc3d2097a694a7' +
        'b067d000000006b483045022100931b6db94aed25d5486884d83fc37160f37f3368c0' +
        'd7f48c757112abefec983802205fda64cff98c849577026eb2ce916a50ea70626a766' +
        '9f8596dd89b720a26b4d501210365db9da3f8a260078a7e8f8b708a1161468fb2323f' +
        'fda5ec16b261ec1056f455ffffffff0180380100000000001976a914ca0d36044e0dc' +
        '08a22724efa6f6a07b0ec4c79aa88ac00000000'
    )
  })
})

describe('edge-rest-wallet', function() {
  it("Doesn't have tests yet", function() {
    expect(1 + 1).equals(2)
  })
})
