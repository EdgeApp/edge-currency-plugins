import { Psbt, Transaction } from 'altcoin-js'
import { expect } from 'chai'
import { describe, it } from 'mocha'

import { info as ecashbitcoin } from '../../../../../src/common/utxobased/info/ecashbitcoin'
import {
  makeTx,
  privateKeyEncodingToPubkey,
  pubkeyToScriptPubkey,
  ScriptTypeEnum,
  signTx,
  wifToPrivateKeyEncoding
} from '../../../../../src/common/utxobased/keymanager/keymanager'

describe('eCash (ECX) replay-protection nLockTime', function () {
  this.timeout(10000)

  const wifKey = 'L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr'
  const privateKeyEncoding = wifToPrivateKeyEncoding({
    wifKey,
    coin: 'bitcoin'
  })
  const { scriptPubkey } = pubkeyToScriptPubkey({
    pubkey: privateKeyEncodingToPubkey(privateKeyEncoding),
    scriptType: ScriptTypeEnum.p2pkh
  })

  const makeTestTx = (coin: string, enableRbf: boolean): Psbt => {
    const { psbtBase64 } = makeTx({
      forceUseUtxo: [],
      coin,
      currencyCode: 'ECX',
      enableRbf,
      freshChangeAddress: '1KRMKfeZcmosxALVYESdPNez1AP1mEtywp',
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
            '905f010000000000' +
            '19' +
            scriptPubkey +
            '00000000',
          vout: 0
        }
      ],
      targets: [],
      memos: [],
      outputSort: 'bip69'
    })
    return Psbt.fromBase64(psbtBase64)
  }

  it('sets the mainnet nLockTime with a non-final sequence', () => {
    const psbt = makeTestTx('ecashbitcoin', false)
    expect(psbt.locktime).to.equal(499999998)
    expect(psbt.txInputs[0].sequence).to.equal(0xfffffffe)
  })

  it('keeps the RBF sequence when RBF is enabled', () => {
    const psbt = makeTestTx('ecashbitcoin', true)
    expect(psbt.locktime).to.equal(499999998)
    expect(psbt.txInputs[0].sequence).to.equal(0xfffffffd)
  })

  it('sets the betanet nLockTime', () => {
    const psbt = makeTestTx('ecashbitcoinbetanet', false)
    expect(psbt.locktime).to.equal(499999999)
  })

  it('leaves Bitcoin transactions without an nLockTime', () => {
    const psbt = makeTestTx('bitcoin', false)
    expect(psbt.locktime).to.equal(0)
    expect(psbt.txInputs[0].sequence).to.equal(0xffffffff)
  })

  it('keeps the nLockTime after signing', async () => {
    const psbt = makeTestTx('ecashbitcoin', false)
    const signedTx = await signTx({
      coin: 'ecashbitcoin',
      feeInfo: ecashbitcoin.engineInfo.defaultFeeInfo,
      privateKeyEncodings: [privateKeyEncoding],
      psbtBase64: psbt.toBase64()
    })
    expect(Transaction.fromHex(signedTx.hex).locktime).to.equal(499999998)
  })
})
