import { expect } from 'chai'
import { describe, it } from 'mocha'

import {
  makeTx,
  privateKeyEncodingToPubkey,
  pubkeyToScriptPubkey,
  ScriptTypeEnum,
  signTx,
  wifToPrivateKeyEncoding
} from '../../../../../src/common/utxobased/keymanager/keymanager'

describe('groestlcoin transaction creation and signing test', function () {
  this.timeout(10000)

  // key with control on the unspent output and used to sign the transaction
  const wifKey = 'KyeNA49yfj4JDoMEWtpQiosP6eig55att3cTv6NBXCeFNsHoNnyM'
  const privateKeyEncoding = wifToPrivateKeyEncoding({
    wifKey,
    coin: 'groestlcoin'
  })
  const segwitScriptPubkey: string = pubkeyToScriptPubkey({
    pubkey: privateKeyEncodingToPubkey(privateKeyEncoding),
    scriptType: ScriptTypeEnum.p2wpkh
  }).scriptPubkey

  it('Create transaction with one input and one output', async () => {
    /*
      This here is the rawtransaction as assembled below:
      0200000001f9f34e95b9d5c8abcd20fc5bd4a825d1517be62f0f775e5f36da944d9452e550000000006b483045022100c86e9a111afc90f64b4904bd609e9eaed80d48ca17c162b1aca0a788ac3526f002207bb79b60d4fc6526329bf18a77135dc5660209e761da46e1c2f1152ec013215801210211755115eabf846720f5cb18f248666fec631e5e1e66009ce3710ceea5b1ad13ffffffff01905f0100000000001976a9148bbc95d2709c71607c60ee3f097c1217482f518d88ac00000000
      The test case deconstructs the value, script pubkey and locktime values to show some deserialized values.
      This deserialization is not required in the usual form from the caller.
      It is enough to pass the full previous rawtransaction.
    */
    const { psbtBase64 } = makeTx({
      forceUseUtxo: [],
      coin: 'groestlcoin',
      currencyCode: 'GRS',
      setRBF: false,
      freshChangeAddress: 'Fpzstx4fKWhqZYbVVmuncuhbEmgecqPTgg',
      feeRate: 0,
      subtractFee: false,
      utxos: [
        {
          id: `0`,
          scriptType: ScriptTypeEnum.p2wpkh,
          txid:
            '7d067b4a697a09d2c3cff7d4d9506c9955e93bff41bf82d439da7d030382bc3e',
          scriptPubkey: segwitScriptPubkey,
          value: '80000',
          blockHeight: 1,
          spent: false,
          script: segwitScriptPubkey,
          vout: 0
        }
      ],
      outputSort: 'bip69',
      memos: [],
      targets: []
    })

    const { hex: hexTxSigned } = await signTx({
      psbtBase64,
      privateKeyEncodings: [privateKeyEncoding],
      coin: 'groestlcoin'
    })
    expect(hexTxSigned).to.equal(
      '020000000001013ebc8203037dda39d482bf41ff3be955996c50d9d4f7cfc3d2097a694a7b067d0000000000ffffffff0180380100000000001976a914d9863e608009f46ce023c852c7c209a607f8542b88ac024730440220558f35be4edc22260bf98fe197e39aff6bfc3717be853735be837a30bd2a0f4202207b2429dd031e851b82836e24524689c70a8c8bf4be58f9b4be23bf3e76fa577a0121030f25e157a5ddc119bf370beb688878a3600461eb5c769a5556bdfe225d9a246e00000000'
    )
  })
})
