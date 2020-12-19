import { expect } from 'chai'
import { describe, it } from 'mocha'

import { cdsScriptTemplates } from '../../../../../src/common/utxobased/keymanager/bitcoincashUtils/checkdatasig'
import {
  addressToScriptPubkey,
  AddressTypeEnum,
  BIP43PurposeTypeEnum,
  createTx,
  mnemonicToXPriv,
  NetworkEnum,
  privateKeyToPubkey,
  privateKeyToWIF,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  scriptPubkeyToP2SH,
  ScriptTypeEnum,
  signTx,
  TransactionInputTypeEnum,
  wifToPrivateKey,
  xprivToXPub,
  xpubToPubkey,
} from '../../../../../src/common/utxobased/keymanager/keymanager'

describe('bitcoin cash mnemonic to xprv test vectors as compared with iancoleman', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  it('bip44 mnemonic to xpriv mainnet', () => {
    const resultLegacy = mnemonicToXPriv({
      mnemonic: mnemonic,
      path: "m/44'/145'/0'",
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      coin: 'bitcoincash',
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
      coin: 'bitcoincash',
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
      coin: 'bitcoincash',
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
      coin: 'bitcoincash',
    })
    expect(resultLegacyTestnet).to.equals(
      'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
    )
  })
})

describe('bitcoin cash xpub to address tests;  generate valid addresses by calling xpubToPubkey, pubkeyToScriptPubkey and scriptPubkeyToAddress', () => {
  /*
  These methods were cross verified using ian colemans bip32 website https://iancoleman.io/bip39/
  using the same seed as in other tests (abandon, ...)
  */

  it('given an xpub, generate p2pkh address and  cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'xpub6ByHsPNSQXTWZ7PLESMY2FufyYWtLXagSUpMQq7Un96SiThZH2iJB1X7pwviH1WtKVeDP6K8d6xxFzzoaFzF3s8BKCZx8oEDdDkNnp4owAZ',
      network: NetworkEnum.Mainnet,
      type: BIP43PurposeTypeEnum.Legacy,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'bitcoincash',
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      scriptType: ScriptTypeEnum.p2pkh,
    }).scriptPubkey
    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.cashaddrP2PKH,
      coin: 'bitcoincash',
    })
    expect(p2pkhAddress).to.equals(
      'bitcoincash:qqyx49mu0kkn9ftfj6hje6g2wfer34yfnq5tahq3q6'
    )
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: 'bitcoincash:qqyx49mu0kkn9ftfj6hje6g2wfer34yfnq5tahq3q6',
      network: NetworkEnum.Mainnet,
      addressType: AddressTypeEnum.cashaddrP2PKH,
      coin: 'bitcoincash',
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })

  it('given an xpub, generate p2pkh testnet address and cross verify script pubkey result', () => {
    const pubkeyP2PKH = xpubToPubkey({
      xpub:
        'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba',
      network: NetworkEnum.Testnet,
      type: BIP43PurposeTypeEnum.Legacy,
      bip44ChangeIndex: 0,
      bip44AddressIndex: 0,
      coin: 'bitcoincash',
    })
    const scriptPubkeyP2PKH = pubkeyToScriptPubkey({
      pubkey: pubkeyP2PKH,
      scriptType: ScriptTypeEnum.p2pkh,
    }).scriptPubkey
    const p2pkhAddress = scriptPubkeyToAddress({
      scriptPubkey: scriptPubkeyP2PKH,
      network: NetworkEnum.Testnet,
      addressType: AddressTypeEnum.cashaddrP2PKH,
      coin: 'bitcoincash',
    })
    expect(p2pkhAddress).to.equals(
      'bitcoincashtestnet:qqaz6s295ncfs53m86qj0uw6sl8u2kuw0yjdsvk7h8'
    )
    const scriptPubkeyP2PKHRoundTrip = addressToScriptPubkey({
      address: 'bitcoincashtestnet:qqaz6s295ncfs53m86qj0uw6sl8u2kuw0yjdsvk7h8',
      network: NetworkEnum.Testnet,
      addressType: AddressTypeEnum.cashaddrP2PKH,
      coin: 'bitcoincash',
    })
    expect(scriptPubkeyP2PKHRoundTrip).to.equals(scriptPubkeyP2PKH)
  })
})

describe('bitcoin cash from WIF to private key buffer to WIF', () => {
  it('take a wif private key', () => {
    const wifKey = 'KxbEv3FeYig2afQp7QEA9R3gwqdTBFwAJJ6Ma7j1SkmZoxC9bAXZ'
    const privateKey = wifToPrivateKey({
      wifKey,
      network: NetworkEnum.Mainnet,
      coin: 'bitcoincash',
    })
    const wifKeyRoundTrip = privateKeyToWIF({
      privateKey: privateKey,
      network: NetworkEnum.Mainnet,
      coin: 'bitcoincash',
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
      coin: 'bitcoincash',
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
      coin: 'bitcoincash',
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
      coin: 'bitcoincash',
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
      coin: 'bitcoincash',
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
      coin: 'bitcoincash',
    })
    expect(scriptPubkey).to.equal(
      '76a914ca0d36044e0dc08a22724efa6f6a07b0ec4c79aa88ac'
    )
  })
  it('p2pkh testnet address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'bchtest:qrall9d5uddv4yvdyms4wwfw59jr5twzsvashd0fst',
      network: NetworkEnum.Testnet,
      coin: 'bitcoincash',
    })
    expect(scriptPubkey).to.equal(
      '76a914fbff95b4e35aca918d26e157392ea1643a2dc28388ac'
    )
  })
  it('p2sh mainnet address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'bitcoincash:pz689gnx6z7cnsfhq6jpxtx0k9hhcwulev5cpumfk0',
      network: NetworkEnum.Mainnet,
      coin: 'bitcoincash',
    })
    expect(scriptPubkey).to.equal(
      'a914b472a266d0bd89c13706a4132ccfb16f7c3b9fcb87'
    )
  })
  it('p2sh testnet address to scriptPubkey', () => {
    const scriptPubkey = addressToScriptPubkey({
      address: 'bchtest:pq2wfeuppegjpnrg64ws8vmv7e4fatwzwq9rvngx8x',
      network: NetworkEnum.Testnet,
      coin: 'bitcoincash',
    })
    expect(scriptPubkey).to.equal(
      'a91414e4e7810e5120cc68d55d03b36cf66a9eadc27087'
    )
  })
})

describe('bitcoincash transaction creation and signing test', () => {
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
  const address: string = scriptPubkeyToAddress({
    scriptPubkey: scriptPubkey,
    network: NetworkEnum.Mainnet,
    coin: 'bitcoin',
    addressType: AddressTypeEnum.p2pkh,
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
      coin: 'bitcoincash',
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
            address: address,
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
      coin: 'bitcoincash',
    })
    expect(hexTxSigned).to.equal(
      '02000000013ebc8203037dda39d482bf41ff3be955996c50d9d4f7cfc3d2097a694a7b067d000000006a473044022041e30e01f06523646374a356a61238da09f67cfbb5017ff7df47be7c5d1fc1bf0220788ed258f1b6d9c2b28d49c10909cd2cf48f49139c1bb9fe6bfd102f9bf4e44141210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffff0180380100000000001976a9148bbc95d2709c71607c60ee3f097c1217482f518d88ac00000000'
    )
  })
})

describe('bitcoincash replay protection transaction creation and signing test', () => {
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
  const info = scriptPubkeyToP2SH({
    scriptPubkey: cdsScriptTemplates.replayProtection(
      privateKeyToPubkey(privateKey)
    ),
  })
  const scriptPubkeyP2SH = info.scriptPubkey
  const redeemScript = info.redeemScript
  const address: string = scriptPubkeyToAddress({
    scriptPubkey: scriptPubkey,
    network: NetworkEnum.Mainnet,
    coin: 'bitcoin',
    addressType: AddressTypeEnum.p2pkh,
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
      coin: 'bitcoincash',
      rbf: false,
      inputs: [
        {
          type: TransactionInputTypeEnum.Legacy,
          prevTxid:
            'E69BED1EBB212A4C2116989D9A543EBC8BA11DD753B2D1F69A963D796EC0950C',
          prevTx:
            '0200000001f9f34e95b9d5c8abcd20fc5bd4a825d1517be62f0f775e5f36da944d9' +
            '452e550000000006b483045022100c86e9a111afc90f64b4904bd609e9eaed80d48' +
            'ca17c162b1aca0a788ac3526f002207bb79b60d4fc6526329bf18a77135dc566020' +
            '9e761da46e1c2f1152ec013215801210211755115eabf846720f5cb18f248666fec' +
            '631e5e1e66009ce3710ceea5b1ad13ffffffff01' +
            '905f010000000000' +
            // psh scriptPubkey size
            '17' +
            scriptPubkeyP2SH +
            '00000000',
          index: 0,
          redeemScript: redeemScript,
        },
      ],
      outputs: [
        {
          scriptPubkey: addressToScriptPubkey({
            address: address,
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
      coin: 'bitcoincash',
    })
    expect(hexTxSigned).to.equal(
      '02000000010c95c06e793d969af6d1b253d71da18bbc3e549a9d9816214c2a21bb1eed9be600000000fa4730440220398da49dabcb8bde7b004d62b7a4f50e0c8b74e5f0f99ebb86ce2932ba3df05e02200ba98a43fa4f67f6252b04f586660ed934ee1ef2c3de6cca3ec3b407c93b095c41210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f4554c8e4630440220256c12175e809381f97637933ed6ab97737d263eaaebca6add21bced67fd12a402205ce29ecc1369d6fc1b51977ed38faaf41119e3be1d7edfafd7cfaf0b6061bd070021038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508bb210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455acffffffff0180380100000000001976a9148bbc95d2709c71607c60ee3f097c1217482f518d88ac00000000'
    )
  })
})
