import { expect } from 'chai'
import { describe, it } from 'mocha'

import { scriptTemplates } from '../../../../../src/common/utxobased/info/scriptTemplates/bitcoincashScriptTemplates'
import {
  AddressTypeEnum,
  makeTx,
  privateKeyEncodingToPubkey,
  pubkeyToScriptPubkey,
  scriptPubkeyToAddress,
  scriptPubkeyToP2SH,
  ScriptTypeEnum,
  signTx,
  wifToPrivateKeyEncoding
} from '../../../../../src/common/utxobased/keymanager/keymanager'

describe('bitcoincash transaction creation and signing test', () => {
  // key with control on the unspent output and used to sign the transaction
  const wifKey = 'L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr'
  const privateKeyEncoding = wifToPrivateKeyEncoding({
    wifKey,
    coin: 'bitcoin'
  })
  const scriptPubkey: string = pubkeyToScriptPubkey({
    pubkey: privateKeyEncodingToPubkey(privateKeyEncoding),
    scriptType: ScriptTypeEnum.p2pkh
  }).scriptPubkey
  const address: string = scriptPubkeyToAddress({
    scriptPubkey: scriptPubkey,
    coin: 'bitcoin',
    addressType: AddressTypeEnum.p2pkh
  }).address
  it('Create transaction with one legacy input and one output', async () => {
    /*
      This here is the rawtransaction as assembled below:
      0200000001f9f34e95b9d5c8abcd20fc5bd4a825d1517be62f0f775e5f36da944d9452e550000000006b483045022100c86e9a111afc90f64b4904bd609e9eaed80d48ca17c162b1aca0a788ac3526f002207bb79b60d4fc6526329bf18a77135dc5660209e761da46e1c2f1152ec013215801210211755115eabf846720f5cb18f248666fec631e5e1e66009ce3710ceea5b1ad13ffffffff01905f0100000000001976a9148bbc95d2709c71607c60ee3f097c1217482f518d88ac00000000
      The test case deconstructs the value, script pubkey and locktime values to show some deserialized values.
      This deserialization is not required in the usual form from the caller.
      It is enough to pass the full previous rawtransaction.
    */
    const { psbtBase64 } = makeTx({
      forceUseUtxo: [],
      coin: 'bitcoincash',
      currencyCode: 'BCH',
      setRBF: false,
      freshChangeAddress: address,
      feeRate: 0,
      subtractFee: false,
      utxos: [
        {
          id: '0',
          scriptType: ScriptTypeEnum.p2pkh,
          txid:
            '7d067b4a697a09d2c3cff7d4d9506c9955e93bff41bf82d439da7d030382bc3e',
          scriptPubkey,
          value: '80000',
          blockHeight: 0,
          spent: false,
          script:
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
          vout: 0
        }
      ],
      outputSort: 'bip69',
      memos: [],
      targets: []
    })
    const signedTx = await signTx({
      psbtBase64,
      privateKeyEncodings: [privateKeyEncoding],
      coin: 'bitcoincash'
    })
    expect(signedTx.hex).to.equal(
      '02000000013ebc8203037dda39d482bf41ff3be955996c50d9d4f7cfc3d2097a694a7b067d000000006a473044022041e30e01f06523646374a356a61238da09f67cfbb5017ff7df47be7c5d1fc1bf0220788ed258f1b6d9c2b28d49c10909cd2cf48f49139c1bb9fe6bfd102f9bf4e44141210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455ffffffff0180380100000000001976a9148bbc95d2709c71607c60ee3f097c1217482f518d88ac00000000'
    )
  })
})

describe('bitcoincash replay protection transaction creation and signing test', function () {
  this.timeout(10000)

  // key with control on the unspent output and used to sign the transaction
  const wifKey = 'L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr'
  const privateKeyEncoding = wifToPrivateKeyEncoding({
    wifKey,
    coin: 'bitcoin'
  })
  const scriptPubkey: string = pubkeyToScriptPubkey({
    pubkey: privateKeyEncodingToPubkey(privateKeyEncoding),
    scriptType: ScriptTypeEnum.p2pkh
  }).scriptPubkey
  const info = scriptPubkeyToP2SH({
    scriptPubkey: scriptTemplates.replayProtection(
      privateKeyEncodingToPubkey(privateKeyEncoding)
    )
  })
  const scriptPubkeyP2SH = info.scriptPubkey
  const redeemScript = info.redeemScript
  const address: string = scriptPubkeyToAddress({
    scriptPubkey: scriptPubkey,
    coin: 'bitcoin',
    addressType: AddressTypeEnum.p2pkh
  }).address
  it('Create transaction with one legacy input and one output', async () => {
    /*
      This here is the rawtransaction as assembled below:
      0200000001f9f34e95b9d5c8abcd20fc5bd4a825d1517be62f0f775e5f36da944d9452e550000000006b483045022100c86e9a111afc90f64b4904bd609e9eaed80d48ca17c162b1aca0a788ac3526f002207bb79b60d4fc6526329bf18a77135dc5660209e761da46e1c2f1152ec013215801210211755115eabf846720f5cb18f248666fec631e5e1e66009ce3710ceea5b1ad13ffffffff01905f0100000000001976a9148bbc95d2709c71607c60ee3f097c1217482f518d88ac00000000
      The test case deconstructs the value, script pubkey and locktime values to show some deserialized values.
      This deserialization is not required in the usual form from the caller.
      It is enough to pass the full previous rawtransaction.
    */
    const { psbtBase64 } = makeTx({
      forceUseUtxo: [],
      coin: 'bitcoincash',
      currencyCode: 'BCH',
      setRBF: false,
      freshChangeAddress: address,
      feeRate: 0,
      subtractFee: false,
      utxos: [
        {
          id: '0',
          scriptType: ScriptTypeEnum.replayProtectionP2SH,
          txid:
            'E69BED1EBB212A4C2116989D9A543EBC8BA11DD753B2D1F69A963D796EC0950C',
          scriptPubkey: scriptPubkeyP2SH,
          value: '80000',
          blockHeight: 0,
          spent: false,
          redeemScript,
          script:
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
          vout: 0
        }
      ],
      outputSort: 'bip69',
      memos: [],
      targets: []
    })
    const signedTx = await signTx({
      psbtBase64,
      privateKeyEncodings: [privateKeyEncoding],
      coin: 'bitcoincash'
    })
    expect(signedTx.hex).to.equal(
      '02000000010c95c06e793d969af6d1b253d71da18bbc3e549a9d9816214c2a21bb1eed9be600000000d84730440220398da49dabcb8bde7b004d62b7a4f50e0c8b74e5f0f99ebb86ce2932ba3df05e02200ba98a43fa4f67f6252b04f586660ed934ee1ef2c3de6cca3ec3b407c93b095c414c8e4630440220256c12175e809381f97637933ed6ab97737d263eaaebca6add21bced67fd12a402205ce29ecc1369d6fc1b51977ed38faaf41119e3be1d7edfafd7cfaf0b6061bd070021038282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508bb210365db9da3f8a260078a7e8f8b708a1161468fb2323ffda5ec16b261ec1056f455acffffffff0180380100000000001976a9148bbc95d2709c71607c60ee3f097c1217482f518d88ac00000000'
    )
  })
})
