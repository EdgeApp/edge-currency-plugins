import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  addressToScriptPubkey,
  AddressTypeEnum,
  BIP43PurposeTypeEnum,
  createTx,
  legacySeedToPrivateKey,
  mnemonicToXPriv,
  NetworkEnum,
  privateKeyToPubkey,
  privateKeyToWIF,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  scriptPubkeyToElectrumScriptHash,
  ScriptTypeEnum,
  signTx,
  TransactionInputTypeEnum,
  TxInput,
  TxOutput,
  wifToPrivateKey,
  xprivToXPub,
  xpubToPubkey,
} from '../../../../../src/common/utxobased/keymanager/keymanager'

describe('bitcoin mnemonic to xprv test vectors as collected from BIP84, BIP49 and some generated cases to test xpub prefix bytes', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip84 mnemonic to xpriv mainnet', () => {
    const resultSegwit = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/84'/0'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Segwit,
      coin: 'bitcoin',
    })
    expect(resultSegwit).to.equal(
      'zprvAdG4iTXWBoARxkkzNpNh8r6Qag3irQB8PzEMkAFeTRXxHpbF9z4QgEvBRmfvqWvGp42t42nvgGpNgYSJA9iefm1yYNZKEm7z6qUWCroSQnE'
    )
  })

  it('bip84 mnemonic to xpriv testnet', () => {
    const resultSegwitTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/84'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Segwit,
      coin: 'bitcoin',
    })
    expect(resultSegwitTestnet).to.equal(
      'vprv9K7GLAaERuM58PVvbk1sMo7wzVCoPwzZpVXLRBmum93gL5pSqQCAAvZjtmz93nnnYMr9i2FwG2fqrwYLRgJmDDwFjGiamGsbRMJ5Y6siJ8H'
    )
  })

  it('bip49 mnemonic to xpriv mainnet', () => {
    const resultWrappedSegwit = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/49'/0'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      coin: 'bitcoin',
    })
    expect(resultWrappedSegwit).to.equal(
      'yprvAHwhK6RbpuS3dgCYHM5jc2ZvEKd7Bi61u9FVhYMpgMSuZS613T1xxQeKTffhrHY79hZ5PsskBjcc6C2V7DrnsMsNaGDaWev3GLRQRgV7hxF'
    )
  })

  it('bip49 mnemonic to xpriv testnet', () => {
    const resultWrappedSegwitTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/49'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      coin: 'bitcoin',
    })
    expect(resultWrappedSegwitTestnet).to.equal(
      'uprv91G7gZkzehuMVxDJTYE6tLivdF8e4rvzSu1LFfKw3b2Qx1Aj8vpoFnHdfUZ3hmi9jsvPifmZ24RTN2KhwB8BfMLTVqaBReibyaFFcTP1s9n'
    )
  })

  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/0'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'bitcoin',
    })
    expect(resultLegacy).to.equal(
      'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb'
    )
  })

  it('bip44 mnemonic to xpriv testnet', () => {
    const resultLegacyTestnet = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/1'/0'",
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'bitcoin',
    })
    expect(resultLegacyTestnet).to.equal(
      'tprv8fPDJN9UQqg6pFsQsrVxTwHZmXLvHpfGGcsCA9rtnatUgVtBKxhtFeqiyaYKSWydunKpjhvgJf6PwTwgirwuCbFq8YKgpQiaVJf3JCrNmkR'
    )
  })
})

describe('bitcoin bip32 prefix tests for the conversion from xpriv to xpub', () => {
  it('bip84 xpriv to xpub mainnet', () => {
    const resultSegwit = xprivToXPub({
      xpriv:
        'zprvAdG4iTXWBoARxkkzNpNh8r6Qag3irQB8PzEMkAFeTRXxHpbF9z4QgEvBRmfvqWvGp42t42nvgGpNgYSJA9iefm1yYNZKEm7z6qUWCroSQnE',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Segwit,
      coin: 'bitcoin',
    })
    expect(resultSegwit).to.equals(
      'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs'
    )
  })

  it('bip84 xpriv to xpub mainnet', () => {
    const resultSegwitTestnet = xprivToXPub({
      xpriv:
        'vprv9K7GLAaERuM58PVvbk1sMo7wzVCoPwzZpVXLRBmum93gL5pSqQCAAvZjtmz93nnnYMr9i2FwG2fqrwYLRgJmDDwFjGiamGsbRMJ5Y6siJ8H',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Segwit,
      coin: 'bitcoin',
    })
    expect(resultSegwitTestnet).to.equals(
      'vpub5Y6cjg78GGuNLsaPhmYsiw4gYX3HoQiRBiSwDaBXKUafCt9bNwWQiitDk5VZ5BVxYnQdwoTyXSs2JHRPAgjAvtbBrf8ZhDYe2jWAqvZVnsc'
    )
  })

  it('bip49 xpriv to xpub mainnet', () => {
    const resultWrappedSegwit = xprivToXPub({
      xpriv:
        'yprvAHwhK6RbpuS3dgCYHM5jc2ZvEKd7Bi61u9FVhYMpgMSuZS613T1xxQeKTffhrHY79hZ5PsskBjcc6C2V7DrnsMsNaGDaWev3GLRQRgV7hxF',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      coin: 'bitcoin',
    })
    expect(resultWrappedSegwit).to.equals(
      'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP'
    )
  })

  it('bip49 xpriv to xpub testnet', () => {
    const resultWrappedSegwitTestnet = xprivToXPub({
      xpriv:
        'uprv91G7gZkzehuMVxDJTYE6tLivdF8e4rvzSu1LFfKw3b2Qx1Aj8vpoFnHdfUZ3hmi9jsvPifmZ24RTN2KhwB8BfMLTVqaBReibyaFFcTP1s9n',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      coin: 'bitcoin',
    })
    expect(resultWrappedSegwitTestnet).to.equals(
      'upub5EFU65HtV5TeiSHmZZm7FUffBGy8UKeqp7vw43jYbvZPpoVsgU93oac7Wk3u6moKegAEWtGNF8DehrnHtv21XXEMYRUocHqguyjknFHYfgY'
    )
  })

  it('bip44 xpriv to xpub mainnet', () => {
    const resultLegacy = xprivToXPub({
      xpriv:
        'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'bitcoin',
    })
    expect(resultLegacy).to.equals(
      'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj'
    )
  })

  it('bip44 xpriv to xpub testnet', () => {
    const resultLegacyTestnet = xprivToXPub({
      xpriv:
        'tprv8fVU32aAEuEPeH1WYx3LhXtSFZTRaFqjbFNPaJZ9R8fCVja44tSaUPZEKGpMK6McUDkWWMvRiVfKR3Wzei6AmLoTNYHMAZ9KtvVTLZZdhvA',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'bitcoin',
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDCBWBScQPGv4Xk3JSbhw6wYYpayMjb2eAYyArpbSqQTbLDpphHGAetB6VQgVeftLML8vDSUEWcC2xDi3qJJ3YCDChJDvqVzpgoYSuT52MhJ'
    )
  })
})

describe('bitcoin xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
  /*
  These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
  using the same seed as in other tests (abandon, ...)
  */

  it('given an xpub, generate p2pkh address and cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'xpub6BosfCnifzxcFwrSzQiqu2DBVTshkCXacvNsWGYJVVhhawA7d4R5WSWGFNbi8Aw6ZRc1brxMyWMzG3DSSSSoekkudhUd9yLb6qx39T9nMdj',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'bitcoin',
    })

    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      scriptType: ScriptTypeEnum.p2pkh,
    }).scriptPubkey

    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'bitcoin',
    })
    expect(p2pkhAddress).to.equals('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA')
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: '1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'bitcoin',
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })

  it('given an ypub, generate p2wpkh-p2sh address and cross verify script pubkey result', () => {
    const pubkeyP2WPKHP2SH = xpubToPubkey({
      xpub:
        'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.WrappedSegwit,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'bitcoin',
    })
    const scriptPubkeyP2WPKHP2SH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2WPKHP2SH,
      scriptType: ScriptTypeEnum.p2wpkhp2sh,
    }).scriptPubkey
    const p2wpkhp2shAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2WPKHP2SH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2sh,
      coin: 'bitcoin',
    })
    expect(p2wpkhp2shAddress).to.equals('37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf')
    const scriptPubkeyP2WPKHP2SHRoundTrip = addressToScriptPubkey({
      address: '37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2sh,
      coin: 'bitcoin',
    })
    expect(scriptPubkeyP2WPKHP2SHRoundTrip).to.equals(scriptPubkeyP2WPKHP2SH)
  })

  it('given a zpub, generate p2wpkh address and cross verify script pubkey result', () => {
    const pubkeyP2WPKH = xpubToPubkey({
      xpub:
        'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Segwit,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'bitcoin',
    })
    const scriptPubkeyP2WPKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2WPKH,
      scriptType: ScriptTypeEnum.p2wpkh,
    }).scriptPubkey
    const p2wpkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2WPKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'bitcoin',
    })
    expect(p2wpkhAddress).to.equals(
      'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu'
    )
    const scriptPubkeyP2WPKHRoundTrip = addressToScriptPubkey({
      address: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'bitcoin',
    })
    expect(scriptPubkeyP2WPKHRoundTrip).to.be.equal(scriptPubkeyP2WPKH)
  })
})

describe('bitcoin from bip32 seed to private key', () => {
  it('generate a wif key from a bip32 seed', () => {
    const seed =
      '1dafe5a826590b3f9558dd9e1ab1d8b86fda83a4bcc3aeeb95d81f0ab95c3d62'
    const privateKey = legacySeedToPrivateKey({ seed, index: 0 })
    const wifKey = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'bitcoin',
    })
    expect(wifKey).to.equal(
      'L4XwV2KLfsWYzaHbZRBGfrYBabYVCRUz8N6juyUDbMxYBPAeVdug'
    )
  })
})

describe('bitcoin from WIF to private key buffer to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'bitcoin',
    })
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'bitcoin',
    })
    expect(wifKey).to.be.equal(wifKeyRoundTrip)
  })
})

describe('bitcoin get script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: '1KRMKfeZcmosxALVYESdPNez1AP1mEtywp',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'bitcoin',
    })
    expect(scriptPubkey).to.equal(
      '76a914ca0d36044e0dc08a22724efa6f6a07b0ec4c79aa88ac'
    )
  })
  it('p2wpkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2wpkh,
      coin: 'bitcoin',
    })
    expect(scriptPubkey).to.equal(
      '0014c0cebcd6c3d3ca8c75dc5ec62ebe55330ef910e2'
    )
  })
  it('p2sh testnet address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: '2Mu9hifsg4foPLkyo9i1isPWTobnNmXL3Qk',
      network: NetworkEnum.Testnet,
      addressType: AddressTypeEnum.p2sh,
      coin: 'bitcoin',
    })
    expect(scriptPubkey).to.equal(
      'a91414e4e7810e5120cc68d55d03b36cf66a9eadc27087'
    )
  })
  it('p2wsh mainnet address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7',
      network: NetworkEnum.Testnet,
      addressType: AddressTypeEnum.p2wsh,
      coin: 'bitcoin',
    })
    expect(scriptPubkey).to.equal(
      '00201863143c14c5166804bd19203356da136c985678cd4d27a1b8c6329604903262'
    )
  })
})

describe('bitcoin guess script pubkeys from address', () => {
  // these tests are cross verified with bitcoin core
  it('p2pkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: '1KRMKfeZcmosxALVYESdPNez1AP1mEtywp',
      network: NetworkEnum.Mainnet,
      coin: 'bitcoin',
    })
    expect(scriptPubkey).to.equal(
      '76a914ca0d36044e0dc08a22724efa6f6a07b0ec4c79aa88ac'
    )
  })
  it('p2wpkh address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu',
      network: NetworkEnum.Mainnet,
      coin: 'bitcoin',
    })
    expect(scriptPubkey).to.equal(
      '0014c0cebcd6c3d3ca8c75dc5ec62ebe55330ef910e2'
    )
  })
  it('p2sh testnet address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: '2Mu9hifsg4foPLkyo9i1isPWTobnNmXL3Qk',
      network: NetworkEnum.Testnet,
      coin: 'bitcoin',
    })
    expect(scriptPubkey).to.equal(
      'a91414e4e7810e5120cc68d55d03b36cf66a9eadc27087'
    )
  })
  it('p2wsh mainnet address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7',
      network: NetworkEnum.Testnet,
      coin: 'bitcoin',
    })
    expect(scriptPubkey).to.equal(
      '00201863143c14c5166804bd19203356da136c985678cd4d27a1b8c6329604903262'
    )
  })
})

describe('bitcoin address to electrum script hash', () => {
  it('tests as documented in https://electrumx.readthedocs.io/en/latest/protocol-basics.html', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.p2pkh,
      coin: 'bitcoin',
    })
    expect(scriptPubkey).to.equal(
      '76a91462e907b15cbf27d5425399ebf6f0fb50ebb88f1888ac'
    )
    const electrumScriptHash = scriptPubkeyToElectrumScriptHash(scriptPubkey)
    expect(electrumScriptHash).to.equal(
      '8b01df4e368ea28f8dc0423bcf7a4923e3a12d307c875e47a0cfbf90b5c39161'
    )
  })
})

describe('bitcoin transaction creation and signing test', () => {
  // key with control on the unspent output and used to sign the transaction
  const wifKey = 'L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr'
  const privateKey = wifToPrivateKey({
    wifKey,
    network: NetworkEnum.Mainnet,
    coin: 'bitcoin',
  })
  const scriptPubkey: string = pubkeyToScriptPubkey({
    pubkey: privateKeyToPubkey(privateKey),
    scriptType: ScriptTypeEnum.p2pkh,
  }).scriptPubkey
  const segwitScriptPubkey: string = pubkeyToScriptPubkey({
    pubkey: privateKeyToPubkey(privateKey),
    scriptType: ScriptTypeEnum.p2wpkh,
  }).scriptPubkey
  const wrappedSegwitScriptPubkey: string = pubkeyToScriptPubkey({
    pubkey: privateKeyToPubkey(privateKey),
    scriptType: ScriptTypeEnum.p2wpkhp2sh,
  }).scriptPubkey
  const wrappedSegwitRedeemScript: string | undefined = pubkeyToScriptPubkey({
    pubkey: privateKeyToPubkey(privateKey),
    scriptType: ScriptTypeEnum.p2wpkhp2sh,
  }).redeemScript
  const address: string = scriptPubkeyToAddress({
    scriptPubkey: scriptPubkey,
    network: NetworkEnum.Mainnet,
    coin: 'bitcoin',
    addressType: AddressTypeEnum.p2pkh,
  })
  const segwitAddress: string = scriptPubkeyToAddress({
    scriptPubkey: segwitScriptPubkey,
    network: NetworkEnum.Mainnet,
    coin: 'bitcoin',
    addressType: AddressTypeEnum.p2wpkh,
  })
  const wrappedSegwitAddress: string = scriptPubkeyToAddress({
    scriptPubkey: wrappedSegwitScriptPubkey,
    network: NetworkEnum.Mainnet,
    coin: 'bitcoin',
    addressType: AddressTypeEnum.p2sh,
  })

  it('Create transaction with one legacy input and one output', async () => {
    /*
      This here is the rawtransaction as assembled below:
      0200000001f9f34e95b9d5c8abcd20fc5bd4a825d1517be62f0f775e5f36da944d9452e550000000006b483045022100c86e9a111afc90f64b4904bd609e9eaed80d48ca17c162b1aca0a788ac3526f002207bb79b60d4fc6526329bf18a77135dc5660209e761da46e1c2f1152ec013215801210211755115eabf846720f5cb18f248666fec631e5e1e66009ce3710ceea5b1ad13ffffffff01905f0100000000001976a9148bbc95d2709c71607c60ee3f097c1217482f518d88ac00000000
      The test case deconstructs the value, script pubkey and locktime values to show some deserialized values.
      This deserialization is not required in the usual form from the caller.
      It is enough to pass the full previous rawtransaction.
    */
    const base64Tx: string = createTx({
      network: NetworkEnum.Mainnet,
      rbf: false,
      inputs: [
        {
          type: TransactionInputTypeEnum.Legacy,
          prevTxid:
            '7d067b4a697a09d2c3cff7d4d9506c9955e93bff41bf82d439da7d030382bc3e',
          // prev_tx only for non segwit inputs
          prevTx:
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
            scriptPubkey +
            // locktime
            '00000000',
          index: 0,
        },
      ],
      outputs: [
        {
          scriptPubkey: addressToScriptPubkey({
            address: '1KRMKfeZcmosxALVYESdPNez1AP1mEtywp',
            network: NetworkEnum.Mainnet,
            addressType: AddressTypeEnum.p2pkh,
            coin: 'bitcoin',
          }),
          amount: 80000,
        },
      ],
    }).psbt
    const hexTxSigned: string = await signTx({
      psbt: base64Tx,
      privateKeys: [privateKey],
      coin: 'bitcoin',
    })
    expect(hexTxSigned).to.equal(
      '02000000013ebc8203037dda39d482bf41ff3be955996c50d9d4f7cfc3d2097a694a7' +
        'b067d000000006b483045022100931b6db94aed25d5486884d83fc37160f37f3368c0' +
        'd7f48c757112abefec983802205fda64cff98c849577026eb2ce916a50ea70626a766' +
        '9f8596dd89b720a26b4d501210365db9da3f8a260078a7e8f8b708a1161468fb2323f' +
        'fda5ec16b261ec1056f455ffffffff0180380100000000001976a914ca0d36044e0dc' +
        '08a22724efa6f6a07b0ec4c79aa88ac00000000'
    )
  })

  it('create a legacy tx with segwit outputs, then create another tx consuming these outputs', async () => {
    const nOutputs: number = 3
    const txInput: TxInput = {
      type: TransactionInputTypeEnum.Legacy,
      prevTxid:
        '7d067b4a697a09d2c3cff7d4d9506c9955e93bff41bf82d439da7d030382bc3e',
      // prev_tx only for non segwit inputs
      prevTx:
        '0200000001f9f34e95b9d5c8abcd20fc5bd4a825d1517be62f0f775e5f36da944d9452e550000000006b483045022100c86e9a111afc90f64b4904bd609e9eaed80d48ca17c162b1aca0a788ac3526f002207bb79b60d4fc6526329bf18a77135dc5660209e761da46e1c2f1152ec013215801210211755115eabf846720f5cb18f248666fec631e5e1e66009ce3710ceea5b1ad13ffffffff01905f0100000000001976a9148bbc95d2709c71607c60ee3f097c1217482f518d88ac00000000',
      index: 0,
    }

    const txOutput: TxOutput = {
      scriptPubkey: addressToScriptPubkey({
        address: segwitAddress,
        network: NetworkEnum.Mainnet,
        addressType: AddressTypeEnum.p2wpkh,
        coin: 'bitcoin',
      }),
      amount: 200,
    }

    const base64Tx: string = createTx({
      inputs: [txInput],
      outputs: Array(nOutputs).fill(txOutput),
      network: NetworkEnum.Mainnet,
      rbf: false,
    }).psbt

    const rawtransaction: string = await signTx({
      psbt: base64Tx,
      privateKeys: [privateKey],
      coin: 'bitcoin',
    })

    expect(rawtransaction).to.equal(
      '02000000013ebc8203037dda39d482bf41ff3be955996c50d9d4f7cfc3d2097a694a7b067d000000006b483045022100f593910a9664342432e52c2d220d4439d44605cf160da35627b9b1ba7a3859680220165ab76bf9301b2bd5a847c6c2d6b27261404fa3f8437495a72f57cdb7fa75cc01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffff03c8000000000000001600148bbc95d2709c71607c60ee3f097c1217482f518dc8000000000000001600148bbc95d2709c71607c60ee3f097c1217482f518dc8000000000000001600148bbc95d2709c71607c60ee3f097c1217482f518d00000000'
    )

    const txInputs: TxInput[] = Array(nOutputs)
    for (let i: number = 0; i < txInputs.length; i++) {
      txInputs[i] = {
        type: TransactionInputTypeEnum.Segwit,
        prevTxid:
          '8b26fa4d0238788ffc3a7d96e4169acf6fe993a28791e9e748819ac216ee85b3',
        prevScriptPubkey: segwitScriptPubkey,
        index: i,
        value: 200,
      }
    }

    const segwitTx: string = createTx({
      inputs: txInputs,
      outputs: [txOutput],
      network: NetworkEnum.Mainnet,
      rbf: false,
    }).psbt
    const segwitRawTransaction: string = await signTx({
      psbt: segwitTx,
      privateKeys: Array(nOutputs).fill(privateKey),
      coin: 'bitcoin',
    })

    expect(segwitRawTransaction).to.equal(
      '02000000000103b385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b0000000000ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b0100000000ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b0200000000ffffffff01c8000000000000001600148bbc95d2709c71607c60ee3f097c1217482f518d0247304402202077dbfcf794ffcceb7351d1bfa51130baf25b3f1fd604a43e88069296464b05022060d1095b36ed20f041443122c694bcbc2209de6e87e69e17c8defb4ba132741e01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f45502483045022100f2768b344facf8d0f9fc0d2617bd36f41faef43fd827969546cfea1ce4e2ee7402201a036100cfcded174fe205fd275bd4299774ce1a9650c4444d610199bfe6849c01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f45502473044022061aba6e1c818367c668ffd120f83692909e7482a8b815e4764eade98ef41319702207e104d38d5ab1718b837acac16c2166ccd29f194e94c11814b4c796bd76186dc01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f45500000000'
    )
  })

  it(' create a mixed input and mixed output transaction', async () => {
    const txInputLegacy: TxInput = {
      type: TransactionInputTypeEnum.Legacy,
      prevTxid:
        '7d067b4a697a09d2c3cff7d4d9506c9955e93bff41bf82d439da7d030382bc3e',
      // prev_tx only for non segwit inputs
      prevTx:
        '0200000001f9f34e95b9d5c8abcd20fc5bd4a825d1517be62f0f775e5f36da944d94' +
        '52e550000000006b483045022100c86e9a111afc90f64b4904bd609e9eaed80d48ca' +
        '17c162b1aca0a788ac3526f002207bb79b60d4fc6526329bf18a77135dc5660209e7' +
        '61da46e1c2f1152ec013215801210211755115eabf846720f5cb18f248666fec631e' +
        '5e1e66009ce3710ceea5b1ad13ffffffff01905f0100000000001976a9148bbc95d2' +
        '709c71607c60ee3f097c1217482f518d88ac00000000',
      index: 0,
    }

    const txInputSegwit: TxInput = {
      type: TransactionInputTypeEnum.Segwit,
      prevTxid:
        '8b26fa4d0238788ffc3a7d96e4169acf6fe993a28791e9e748819ac216ee85b3',
      prevScriptPubkey: segwitScriptPubkey,
      index: 1,
      value: 200,
    }

    const txInputWrappedSegwit: TxInput = {
      type: TransactionInputTypeEnum.Segwit,
      prevTxid:
        'e9f28846381667b6beb57698ab824b597312428cd026d45e9e3a13c95e335d9e',
      prevScriptPubkey: wrappedSegwitScriptPubkey,
      redeemScript: wrappedSegwitRedeemScript,
      index: 1,
      value: 200,
    }

    const txOutputLegacy: TxOutput = {
      scriptPubkey: addressToScriptPubkey({
        address: address,
        network: NetworkEnum.Mainnet,
        addressType: AddressTypeEnum.p2pkh,
        coin: 'bitcoin',
      }),
      amount: 200,
    }

    const txOutputSegwit: TxOutput = {
      scriptPubkey: addressToScriptPubkey({
        address: segwitAddress,
        network: NetworkEnum.Mainnet,
        addressType: AddressTypeEnum.p2wpkh,
        coin: 'bitcoin',
      }),
      amount: 200,
    }

    const txOutputWrappedSegwit: TxOutput = {
      scriptPubkey: addressToScriptPubkey({
        address: wrappedSegwitAddress,
        network: NetworkEnum.Mainnet,
        addressType: AddressTypeEnum.p2sh,
        coin: 'bitcoin',
      }),
      amount: 200,
    }

    const base64Tx: string = createTx({
      inputs: [txInputLegacy, txInputSegwit, txInputWrappedSegwit],
      outputs: [txOutputLegacy, txOutputSegwit, txOutputWrappedSegwit],
      network: NetworkEnum.Mainnet,
      rbf: false,
    }).psbt

    const rawtransaction: string = await signTx({
      psbt: base64Tx,
      privateKeys: [privateKey, privateKey, privateKey],
      coin: 'bitcoin',
    })
    expect(rawtransaction).to.equal(
      '020000000001033ebc8203037dda39d482bf41ff3be955996c50d9d4f7cfc3d2097a694a7b067d000000006b483045022100c10c70dab0e8e88a67bb013d276b88b3d5a52d3cb3ec53aa7d2e7c4704e89dc602207fabdfa3b55b196da7792de9fe436535501fce2fe76439d5361bd5d9dd69bd0901210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b0100000000ffffffff9e5d335ec9133a9e5ed426d08c421273594b82ab9876b5beb66716384688f2e901000000171600148bbc95d2709c71607c60ee3f097c1217482f518dffffffff03c8000000000000001976a9148bbc95d2709c71607c60ee3f097c1217482f518d88acc8000000000000001600148bbc95d2709c71607c60ee3f097c1217482f518dc80000000000000017a9142427d83a84e5793ce6f6efc33020d844dd217dbb8700024730440220008a9738e8acdc002ae4bb415ff7368161057ed9b22fd8b671c5acbb47379a69022045ab99fa73730fa367d3972d41b26b4ef337b34c4e593c4f47800ed4ee1c64fd01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f4550247304402201d4f3ee993cfb468dc41387ac618081c36c49ebc9db528155b51d346382c347802201d1c07201f80df3e6e86195444532b6be86e9a429a7eb5a0ae268df9760a974601210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f45500000000'
    )
  })

  it('create a legacy tx with one input and 100 outputs, then create another legacy tx with 100 inputs and two outputs', async () => {
    const nOutputs: number = 100
    const txInput: TxInput = {
      type: TransactionInputTypeEnum.Legacy,
      prevTxid:
        '7d067b4a697a09d2c3cff7d4d9506c9955e93bff41bf82d439da7d030382bc3e',
      // prev_tx only for non segwit inputs
      prevTx:
        '0200000001f9f34e95b9d5c8abcd20fc5bd4a825d1517be62f0f775e5f36da944d94' +
        '52e550000000006b483045022100c86e9a111afc90f64b4904bd609e9eaed80d48ca' +
        '17c162b1aca0a788ac3526f002207bb79b60d4fc6526329bf18a77135dc5660209e7' +
        '61da46e1c2f1152ec013215801210211755115eabf846720f5cb18f248666fec631e' +
        '5e1e66009ce3710ceea5b1ad13ffffffff01905f0100000000001976a9148bbc95d2' +
        '709c71607c60ee3f097c1217482f518d88ac00000000',
      index: 0,
      // prev_scriptPubkey only relevant for Segwit inputs, but keep mandatory for now before we start handling errors.
      prevScriptPubkey: scriptPubkey,
    }

    const txOutput: TxOutput = {
      scriptPubkey: addressToScriptPubkey({
        address: address,
        network: NetworkEnum.Mainnet,
        addressType: AddressTypeEnum.p2pkh,
        coin: 'bitcoin',
      }),
      amount: 200,
    }

    const base64Tx: string = createTx({
      inputs: [txInput],
      outputs: Array(nOutputs).fill(txOutput),
      network: NetworkEnum.Mainnet,
      rbf: false,
    }).psbt

    const hexTxSigned: string = await signTx({
      psbt: base64Tx,
      privateKeys: [privateKey],
      coin: 'bitcoin',
    })

    const txInputs: TxInput[] = Array(nOutputs)
    for (let i: number = 0; i < txInputs.length; i++) {
      txInputs[i] = {
        type: TransactionInputTypeEnum.Legacy,
        prevTxid:
          '8b26fa4d0238788ffc3a7d96e4169acf6fe993a28791e9e748819ac216ee85b3',
        prevTx: hexTxSigned,
        index: i,
      }
    }
    const base64TxMulti: string = createTx({
      inputs: txInputs,
      outputs: [txOutput, txOutput],
      network: NetworkEnum.Mainnet,
      rbf: false,
    }).psbt

    const hexTxMultiSigned: string = await signTx({
      psbt: base64TxMulti,
      privateKeys: Array(nOutputs).fill(privateKey),
      coin: 'bitcoin',
    })

    expect(hexTxMultiSigned).to.equal(
      '0200000064b385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b000000006a47304402206683e9b5a8d160a07fcfb05d82ef076df2bcb5bc959f3e42b554a6151d376866022078a25deced4db896d898f1cdd1b656ed8d91f6176d95c4b6b974e24d55a4130201210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b010000006a47304402207080e220d7259bebec32f09ef6537994d351cce188c5c3bef8233e3ce4180b020220425c1c5e135ef328d73e9d8687aa33a197876d9e87a2991ee7f6b0c5e5a3c38501210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b020000006b48304502210095850db1aa73abb5058a0174a929063506719267a4d290caa69ab95c90415e50022057b4e4c1463d0dc9afe134c76b4171bd12fa1fbfbe20873461aedac1770b0c2701210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b030000006b483045022100aadd0086cab2eaae30140664e7ecd86fddd6783c6a022d6f05334433d405135002201b3d95221fcb6f6b1c89880fa80e0d40a90286931394319da5f1432577fcdf6901210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b040000006b483045022100b727ab1ef1d42bf15fa46a28a73a49b1e8eead1a71bd7a05241901d855bcf38602203444919fcb440d3157fc26c224d296ddb279e18420716d4e648cb418f73a44d501210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b050000006a4730440220262bd57aaa4e4449e37ae0bba2c41e8f6b528117596ce607911980185e0697770220625628eb50fb70407884035cd6353bbd3241fcefecc30fac1574052284794f0101210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b060000006a473044022029c64b0be7c6a692552040acb40bf0bdb9139166180c61694d9bdb996dacbd8902201188ccc92604b0fdbdd50569f437207aba3069e5177afcebed868e29a665b65b01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b070000006b483045022100847129d327e95ccb89e9d1dfb812570a344d77255a993d7475f840ae27ceb0510220594f48af1529c14619debbee6538337e1a1555d8c9dfa6b0be9563005b253e1101210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b080000006a473044022007588d5f5bc74d825af59de7f07f8506c2fe2e615cc085838b963bd01b36885e02205dac14d8bc087b5483bb8e6c3347307373ef7ec9c38889d637793cc9b5be7ec101210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b090000006a473044022045f78a1b2ffbc63f74ae0c529655ff7a8d86713b3042df1c4ee3b177a69b41e6022004b197139d35258aeecb6134fc260a256ecc9d6ea105494e176382c2b079371901210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b0a0000006b483045022100bd9aa3dc2f362043629c8c2d838d8c2fb9609ce62af95a0c42506db5458fc4d702205775d7dc1f22734df1acddb18dfc956dacfcab53ab34e7d319e71fd4fc30540901210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b0b0000006a473044022016cfb933c9e993bb0187296b53db8d6c0575e6b933d246e14f18db44f33f65aa022078013d031eae6318adfa2c607b090318c69d5465b74b4904f04bdd9b170a284a01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b0c0000006a473044022003eda28758f52429882b8788679fbf551fa8a4781e331a06cca28432dbca3f54022025a5e5eee97f0145f66533f67c3c5b048a540493f9748381b4caa006e1c7d16a01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b0d0000006b483045022100e5b2d0d4c6795786b229fd6e59f6cff14672098d71fc817b0fb6f1443c7e67c502206a84e5454754e584c9b2e120f809f663fe6c34fcfc34850201b0fee201a6492701210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b0e0000006a47304402206e15b34ee323614cff907cf4ac857092459e3c55ac526152526c44fa36a8995002203eb66887b2121ac3f6192e865e91caf4cc163fd2a8f6c7767ea435005cd760bd01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b0f0000006b483045022100e778f551be91e9f2fe8ecf6873c7af2fd63d6bb21fa0950c6f5b0d784169da3902202562f50dd3792676b2b1f2c18f8d96435e486a144e76c13513ecad9a27e529c801210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b100000006a4730440220282a87b4fc791f0bf885221622ab3bbe258912103c64c38b765946aba8f44eb202207c794d3dd9b641a973a7ee121cac9c628b7e789bc6f046149a4774b6df95fac001210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b110000006b483045022100b158f4ad45071266a3a5719ac35e872182feaace479acdf0e9b964eb88c9287c02202e12de0f3c34647d0a78ddcb3be1eb445c46179b263852eddfba939992aa1b8a01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b120000006b483045022100eba31d4e328eef8cc5795d97738f1ce9c3c53b1a0fcae5ca8d7cf826f0dbb5df022022d5812515b7d82e2572f33aa207ab79a48b75d4f1c511deb12a99d57ee26b6301210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b130000006b48304502210086b24e5c066c18330400a30e51d1305338aed2f52accb932866a394c9762a1fe022022bbd324291514e65e001d5c55d1a62eceba15b187aba212382fac1485fa275401210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b140000006a47304402207e45519d015dd8119e0595ecb1bda87322902bce63a556a9dc2289644e0cfe660220076ce50ddb656d395c22d323f2211c1dd29ff06dc6c08f0bf06df9ae01abf94f01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b150000006b483045022100d199a8e3b7859873f46b9580f0459aa82c53412b8f5031a16ce51bf9df1af13602204ef1d2e7c9fa3d3ea88b30f87a438422149b29c68ebf9e9d087de0ec5255015b01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b160000006a47304402204cb1a70b1a7775fc5314daba803cabcbd1804dd0c92c70550c1625d87cf1e5ea02200e0a4c0ef6858e61c4079c3bd13256055633bc907aafcb0d5a95111c819c6f1201210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b170000006a47304402204dda29f0916551d74a2b3278b95cc725c046509a041c40e7daaa8ba56298ed80022018bcca8be4b8501199929704c8ba97b04143236481445e189140c2489daef0ac01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b180000006a47304402207597472ebf840e5eee82440e11df039881e6f41ee977dd3220eef340e9416fab02206f6c9e16b6a342b8de8a9f0b662c8335a8c1d0050c2c47dd8e9f5c25e8f111a001210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b190000006b483045022100f44fbd47d73a4e7180001ecc5bb06cb68e8cef17e4398dae9004ea8cb6adf7b702206cc01b6c07750d9d47c19fef4e013f2c2968e235931a4222bb60bb76aa01509301210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b1a0000006a473044022032d7a28242e1943cc52d0a76b759734659bf7a410e5a424c0dd6aad7363786d7022025119367c1ca678ddc0c6d52790881ff6eb76e29c5f7cd8299a09bbe4143e14801210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b1b0000006a47304402201e2bdff50f57dedab81519a25c60c8fe38952fc42ef01e9169578ebc2de770f002200152732169be67ebbb100e5203e05b8faf6c8c4bbd0957cb52773f170e8b8c2701210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b1c0000006a473044022074de5ab1a0e05f8d1a2543d2bd17f318aeef95dacd5a1e7b1e62b3a4d995102302207c574d1b681343b91b2ac37a71ad478257d819015ab5b9a7a3caf7ec2266907801210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b1d0000006b4830450221008490eac32b4a27374538cd1fe29866d380ae68289cc55b9f79c746c25ee7d12202200b6b214954a9ea945d77ac83ec4b0842c237f7f0397ea9155e1e0dea852f545301210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b1e0000006b483045022100ec62bca338dfdc9a0d4696caa7a204cd31e29a2816b3c80aabf0fa01cbf8e8e402204f3c3a5dac5e4249a03c6323aad9382a049c720f1b39561d62f9eb7e1b76403201210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b1f0000006a473044022019395373080cf617d147746cfab0dbea980af088ee09c7b155b34d055c4ba3710220674a07f5f1718248d4ea29a1aec2f52615721ce5fd4c1af5e183fcd2190ea5fc01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b200000006b483045022100d8b6e336a274444eab57714b2e1928b2e9b336eb7508bb26a4b4b995e26e7f4202203ced9d406be2903e5f6bce47ab12cd45be82d37e709ab78947ce3920ea6d500901210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b210000006b48304502210091952874edb6f7f9c60694185f095c2f8c8e693d998c705debba88688e3cb95a02205dd88ad01cb2c1214971de6a9eb0de12151b4ce589a2049f4a358a59b1e4ed7e01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b220000006a47304402202cfdf806d2113b523a7ad07d9ea30461618ba92d42025c579ffd937356219f98022048c55221781e4665183fd925ee0b1ac89480795c78485de7569e60a2ad90a29701210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b230000006b483045022100af9e487b58fb8cf77a669f19021d2cd9144eb97545d99c3fd271f55c90799d71022073b3bdd9584e5139e9b3fd1f543e666b1eafa0ac01764acc0158c0be0abb960b01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b240000006a473044022033f609f628648cc335d3077d199671cb01ad86d95289b9a166edcb5383e55e7f02202adf48a6482736e9411f48c4563f9e57836836b338d0fed05e6b2cf2744aee8301210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b250000006b483045022100ed72634eb47a2d64dacbb32415ef1d5ec2fb08ac71243e0155205d0a5833d93302200e930bde8220f33266fb6325796645695a0163ecba2db11702a3a542f2b4a3b801210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b260000006b4830450221009c12d8c3cca1933820af5ba48f8b52a2700e207391524e09e06c6b1c6a3e7d270220611f875581999cd4dc7b63ffee6b96c60d25774e85733384b2fdf1d733b78e2c01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b270000006b483045022100fedcad1692ef96d2485d2274fb81f63f940cff5b303bb00dc36436840d6b161b02204732d19ff025ee70994286ba2aec18664e6997635c2ef64778706a898ac0f6c901210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b280000006a47304402203c71e0448efc0d0835cbd48e87ff0f6856ab70e0737fc5f67fa0e965ae22a040022004893706c2ab0b12b197f4adf6cf9130fa30bf1a374d40e2226d003658947d9501210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b290000006a473044022044a73115b26f4825188c10e9f166f37938efab4a7f66f1785c6f99276871b12c0220604d3d4a3f605cb8460948abe0f29150995c162536613238957c9e786f55c13401210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b2a0000006b483045022100a9604bf2ddac9ff6542425015e432079806e3a663d3e45699bba1ae06d1579d30220451a3e2088cd302d1fe13273cb07d2745ae05e86c00e56b5d3cd265b47b0f2cd01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b2b0000006a473044022021229d44fce97fe3a918bfebcab8cc7738da0b2ef0f35c3db2a96e19cf11a819022002b179a58822d2e04365938163afb5dcc7cb31352e826c9d50926ef4c525133901210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b2c0000006a473044022078a84551ddb789600391ee65e103471a78a86cfc36f66c5ba90a10edd5c4443d022052f3995229abf0c716989087c65349008c256310ca5331f26bc4522de429d65701210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b2d0000006b483045022100ce8fb70ba77321f782a49c7d7ce470886e119cd7182cf9f9c10e4021fa0baf900220261228d931ca0db503f72852c33cf32c369542850636ac8d3c3f0a786cc2340201210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b2e0000006a4730440220188e7b5f4389f0ce3f1a894f301a9ec3c99557eaf2a85e04f9d30b545fd5d1ca02207cfa0af26770d52e2157ed1b41abaaf0bebc3804645dd6ac0d2b32d3347a639601210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b2f0000006a473044022035e197eff583b1dc303af84a5b4d59e3e476f9a083ecbeac059a0bab324f0545022017117e44941cfd7e72f3c0fa6092f2f2010b56ff58b9e8675d709bb15d40b7a701210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b300000006a47304402202ee1464eb344893010575bb814c975326b2ad91dea73c5d74f42b718f8399a7702205c6d5f4ae5941f455f844c9a3b60092240e38c3a7dd9e87777d9bdef25d96f2801210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b310000006b483045022100db53a253623799785c7213d19a617c921f9694d06a35268e06e80ad3767864390220096d5c64c9b364374d3233f10d649aa831ff1209f3dc0fecfa5d63e2f78492d801210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b320000006a47304402206b2209549161dd6f42f10adb3ae329f202afa087d64d6ca13c81ea2e90f375da0220667296eb8a659731584f1a92c7a68fe2145fac4e6f51b53d1bf0122c9f24d17c01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b330000006a4730440220691e1d197dfa48f76a0f44c2d16ccb16b34e4b4996cc391eca2afb3f336e6afe0220621af6bea96a624716174236f74db74c14ba3b84c554bc6cbbc6d748d04d455601210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b340000006a473044022052e81eb266bc78193659a3261a6bc017c40942ea6fcb57aec82c87f92e5920c90220267f608bd89f3d021ac08614691d7f947caed8d79cc71bf4ea0251130984525401210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b350000006a47304402206672b58ae638e56ea4c9b3a0e57a943a0180a59bee1730fb8f889b3e3369fb5202207821c9d18bcb28e21cedbfc084abb487aa788d84b051838bbffcfab19ebf542401210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b360000006a47304402202771af7b5c0fdecd3ea65c069cabbf13080c79e8bef448c0ad3da350e72e772c02205258a47d1e577df6582787dd245f3dd2afdd8ff7518c02444efef35f8ba3e94f01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b370000006b483045022100c766fe11903c522a52912d027b2121f14c9f0a088f9076d703d37aaee6113129022058ac1bdf4e3458c3dd81d1a776cb18579927cdece38e41d4ae990b51f6f17d3a01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b380000006a473044022023203edd68ae724d0872494a960ec01e4c5ed468095332d79c4c9228c11131b6022040dcebcc8cbf3f8bce7e631d8a4faba0c5f09cba578194ae31212b24845d535b01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b390000006b4830450221009547ab716a06af101eaa5affa01389638788a563550104928bb041128523a66402207459d182bc8d89f9acbcd833dfa96629b07f62474f60d29378c686d7221474c601210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b3a0000006b4830450221009f661d7f378db7af9279aac83ebf743e8a31d6678e8c2ef0f2be57259d2815490220408147b5c8a74080ffcb5bb9c7919db4a27272948e3cb760079bfa21a827cdc901210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b3b0000006a4730440220225b083b80c3a1be7807375afc78b6d8bab981af2b603836cf30cf5a8ea3efc1022019d87ea26616930b0e3fe7b6c031761540a5de9efc5707271ebf22ce30138dc501210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b3c0000006a47304402204daefd8b9463e5f0e4ed2898342b7755a4ff3f9719b57bd4d90f16c356daa5b6022070e6db1438a59daa964a8e10564e99b9a9b1060b2e47b2777bdeaaeb6ca854a701210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b3d0000006a47304402204d2597032d70949938b23b3a75d249a734506e04ae67e7854b973af03dfd3e7502204ee75669458ae68351e941d97a37ad7723aecef2a93aa23ae3692295e1d205e801210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b3e0000006a473044022011e99d00b9b6ea541d3f4e59d6b8a837bdb9dc9f720d965c4a88cb7f52a06d3702206f1d787b3710ee85617f705ce04719a66b2a9da06c9580d5b07c49b2c078e7e201210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b3f0000006b483045022100fa9fa4e986ddb43b3ea15495349627e4981bf9fca62631e679ba1891d4e6b90b02201829b908b649ee94e65f981783a8cb0aab01839f080a11bb67001c20f1526fe701210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b400000006a47304402202cf16dfad2e1270138720c437bd594a9144ad70e5904b4809a874c4bcf2e17af0220047ae793f6c385e9fbd427b018dad9a8d5cb9db04aae59dcb445bf0d58e7584c01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b410000006a47304402204de8442a58ea3422cbe4c45a0059070ca615c362dd22046bb36bc681b72ebdaf022000a938ec83d65c1061ba06a42bbdaab471a3fa903398eb2d7a561d09b6780c0401210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b420000006b483045022100ff11cab129081f0e24a6f2040b964defb89123436d6562d36a530b2d15410673022072e69c869f04ee959023f46ec2b059a39c1385bca722fbfa6e3f598c46195a6d01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b430000006a473044022018e053fb5f5cf3fd95edd240aa64605952023cb6d4d0a5e7e8b8ad778d6170ae022010774e2ad35cfa5ef7bd7761689f7a8f42a8efbecdb598219618b14e922b770201210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b440000006a473044022024023900ddc990b39fa8b67cf74e87d3510b1aaacf968815c4a6ebc8de110acf022070b9f3ab2e39d3585eaf1be32a82b5307e06766a6c9e1499609d97790ca4e64d01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b450000006b483045022100e850ea1e01b7493ffabc9fd21b1a849e8f8adb14316566ca8021c2fea6f4f470022004ec7e73e52f7738c136b9746ac8980dc6ebc7703e321363c6d68365dfae187401210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b460000006b4830450221008d80556b31fc7270b2e73279247d84366e1b22566599b8bb0127bb0e272917b1022028342ceb29385e83007148c97f58a421454ee46ea4a16273dc3412c6c8a0c10401210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b470000006b483045022100eaa1b2d591e4dc6bb624c6f66635d55c7cedac51e984765d323867dc33e945ab022039e8fac64c736aaf244ac4e9fbb3445e47a624e38a60d306aa25ca6251d535be01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b480000006a473044022057b6db4648716efd3b9069e2232f06da40e7fe0aab50fd80daba07c2bded1af302205065540794160204d7e102a2b8e58db17d0af0765bf6ecf6050e28e356544b2101210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b490000006b4830450221008ea85643edb54981ffa4c0fea92b7fe6e29517f2f732ac7b4c86a84706150ea9022026f9aa08f42e8be97f4f026ee4039108afff4cb3061fea17d6ee0700d264b92d01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b4a0000006a47304402206cf1dca74cee2896670a1d538f7b8166193b4c773e5de02522c581258d5fc5b4022076a10c72ff36e1321dc07eab6f81a2d652be00b667e5aa1f0c286a05f69682ef01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b4b0000006a4730440220701a01d78eaea18ae1d2773bafbf3fdc35a5dca9c69466c063b96d5abb28b91802200b7550c04df2314cf3296cb52c56535dae5e260121bff740021bf3894d66f4be01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b4c0000006a47304402204114474d3b828fbd0f7bda26e08171659cf4f34f3b258af9961e8a619cd2f65902207bc03505f187136ab150bdcaa7f7386aed1a199c23ebc9ddf09e8e8cba08838601210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b4d0000006a473044022021e3fb08676fd9ecf2901148d15b44bb0bdc3adf799797ce49346c13d603022d022071d07620eb33d8c13d2efe47af80e0376e54cef9887359831fa1323635a0ceaf01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b4e0000006a47304402207161f8a531bb02b613da054fb1704516037639fabfeb9728ed33d7019bded05c022040af21d52431c40837c3383c6300f1589c1e228e4f71764157f8c84a0a62b9cf01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b4f0000006b483045022100cb872254b5e6ff86740ee4c9a4fb752096e57367859f771910bd5cc107a3b3b2022024b37f0d46db3e0a877738ce5d22b046bfb9c9aae0aa024d7e9216dbeadc9fc501210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b500000006a47304402205bb1670aa9d5969a22d00af7253db69fefeb81d2bd4d286545eb4c09f573c86d022076b39bb8a936081f4b46e0d78a83724daaff1536c7930d1fb77775596c455e3e01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b510000006a473044022067d88ee2e9238b8246efd8dd24bbb3a1a4b13d5e89fdead0bae56cc674da4dc202202eca7743440b37dca047b2f25740471646d86cb09b9918d22c436120dbce296901210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b520000006a47304402201e7c2a306660afde029840419fbcb072c13fffe9e7ab364b9261e21fe24fcdf50220491c30c5a5af93975099671a14ee42f301bdf50a14195c7d7a4e09049e3d22a501210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b530000006a47304402201379195b722e493634f468723e8d4a8fda1003d3ddde3af610f614f8d8301a88022059825f2c450734df0456ff40d99a1cfad9268341ce3c3ae5c44c48379273a59401210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b540000006a47304402203d976837fe3fd518466d165ee7ae3a9459df11ac441498a0e51670ea3f25c0bb0220024e426d89779cee2b9076653c2c28c623a5f0f55793cad3503d6b1f5d6443ed01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b550000006b483045022100d8c1f2cdc6c4dab33bc9b728f0cf711819e4a49223192f19faad469bfeacfece022031682ea706317012e7ec10fcaa137d566b0869c343fce60e21f0fd6202bc085001210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b560000006a47304402200de31b7479463c3ad04866afca6892c33228982bfa86de0cc66dddd0d8160c53022056c4cfc1b7bd603463d5919d9b5a8d8a1e1e27512d26f72413ee19ca74f997b501210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b570000006b483045022100e119573131518cdd363c12ef6c4f23af615fd0b60774caa036d34dcfe5ea9a0002203c8b867a802ac6f807faf7a2a1419fd77b8dafec504c6b65ad7fe02bf32ae48401210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b580000006a4730440220792f119f30121bb51c1e9c1944388a42605ca44f3e9354a43a212d95cb56e036022079f1ace9ecadf7bc9fa66fffc82e012b2c59ba3181d6d9ede7b16e7b535f019e01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b590000006a473044022012704d36bece32111ba49e1cfa9a11df9975aa89c8c2d93921ab533212f2838f02205292d589d8d586a744405b9ea5890112e1a07048d168414be62eaadeaae7f2e701210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b5a0000006a47304402204167579ac2fe05deec616a8f1fa08187a07f5ae07237a1da163870dfce9fcbbf02201ac722d176e8aa72f9fe3720619318b725206de97503d94c1bfd98df888ca43201210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b5b0000006b483045022100e93088eda42988bf6969995dfbc202ec547431f4ea11f5a71d2c4f94ebee81970220558a0f163040e6ed23569d1fc40be5b5ec0bba61b595a8553b0be1720fb4d7c201210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b5c0000006b4830450221009d1467ee257324c705e0d81a563c40467c9f4789fc43f98edbf7a557baf0072702205bce2d605a1483b0a57817890c921fcde923beaed25613ec84620ee504d28ae501210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b5d0000006b483045022100d6254fc3ecf828bb6c4ace4eaf87eadf4d40c683c8fdc0d1fbb80b14ee1a797802207122d3c61472c05ee042283cac41bbef6ded238c7a062489bc23055515cc630501210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b5e0000006a47304402204066d76981fb8182bb25a36f7670b8cb5215c8bc1a365155f0348ceef53f7613022010a818459f5b766db2d7ae5e48c21036593fc058ca84060d3edf5c9a232ced1301210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b5f0000006b483045022100ba05aca8c77d4ff05ededace35b15d5240ef39953d869933e6d903f2c51dedc20220141fa2c506fd8470d44860f16e8549eaa9c7ec2a1861b13e20efdbda4275ea3301210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b600000006b4830450221009e568a5d07dcc0901342150cc90931e2ed703bb6ddac8707e558ba5834c3794d02205647ee6db6933dce54e0feb90396984e518e3b84199d4af1d9d469e5823353a101210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b610000006b483045022100fb72deaa7c2eae0c93b2b650754f05753f04fbd25e5344d6a6afe82a7c504b28022052070434f9f021c279ddb5d9888632635f710f9c353696f988ed6dbce91d0ec901210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b620000006b4830450221009853646aaea7a5bc1e3da4f057ae13dbf4c3e1c4cc88d410d72affc6185fdb4702207aba2ef789e06a083753d46893a9786735b5141244bfe5323858c75dad40331b01210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffffb385ee16c29a8148e7e99187a293e96fcf9a16e4967d3afc8f7838024dfa268b630000006b48304502210089111279aef0a58a3722d12a671593c8919da95314fdb5e0c49dea2512fc328902207a7a2518b3fefc2a4b743519d89ee64412744100fb490e2b08164209885127f401210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffff02c8000000000000001976a9148bbc95d2709c71607c60ee3f097c1217482f518d88acc8000000000000001976a9148bbc95d2709c71607c60ee3f097c1217482f518d88ac00000000'
    )
  })
})
