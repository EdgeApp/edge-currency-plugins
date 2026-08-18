import { Transaction } from 'altcoin-js'
import { expect } from 'chai'
import { describe, it } from 'mocha'

import { info as bitcoin } from '../../../../../src/common/utxobased/info/bitcoin'
import { info as ecashcom } from '../../../../../src/common/utxobased/info/ecashcom'
import {
  makeTx,
  MakeTxArgs,
  privateKeyEncodingToPubkey,
  pubkeyToScriptPubkey,
  ScriptTypeEnum,
  signTx,
  wifToPrivateKeyEncoding
} from '../../../../../src/common/utxobased/keymanager/keymanager'

describe('ecash.com transaction replay protection', function () {
  this.timeout(10000)

  // key with control on the unspent output and used to sign the transaction
  const wifKey = 'L2uPYXe17xSTqbCjZvL2DsyXPCbXspvcu5mHLDYUgzdUbZGSKrSr'
  const privateKeyEncoding = wifToPrivateKeyEncoding({
    wifKey,
    coin: 'ecashcom'
  })
  const scriptPubkey: string = pubkeyToScriptPubkey({
    pubkey: privateKeyEncodingToPubkey(privateKeyEncoding),
    scriptType: ScriptTypeEnum.p2pkh
  }).scriptPubkey

  const makeTxArgs = (coin: string, enableRbf: boolean): MakeTxArgs => ({
    forceUseUtxo: [],
    coin,
    currencyCode: coin === 'ecashcom' ? 'ECX' : 'BTC',
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
        // prev_tx only for non segwit inputs
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
    targets: [],
    memos: [],
    outputSort: 'bip69'
  })

  it('signs an ECX transaction that Bitcoin rejects as non-final', async () => {
    const { psbtBase64 } = makeTx(makeTxArgs('ecashcom', false))
    const signedTx = await signTx({
      coin: 'ecashcom',
      feeInfo: ecashcom.engineInfo.defaultFeeInfo,
      privateKeyEncodings: [privateKeyEncoding],
      psbtBase64
    })
    const tx = Transaction.fromHex(signedTx.hex)

    expect(tx.locktime).to.equal(499999999)
    // Bitcoin only enforces the locktime while a sequence is non-final, so
    // this value is what makes the transaction unreplayable:
    expect(tx.ins[0].sequence).to.equal(0xfffffffe)
  })

  it('keeps the ECX locktime when replace by fee is enabled', async () => {
    const { psbtBase64 } = makeTx(makeTxArgs('ecashcom', true))
    const signedTx = await signTx({
      coin: 'ecashcom',
      feeInfo: ecashcom.engineInfo.defaultFeeInfo,
      privateKeyEncodings: [privateKeyEncoding],
      psbtBase64
    })
    const tx = Transaction.fromHex(signedTx.hex)

    expect(tx.locktime).to.equal(499999999)
    expect(tx.ins[0].sequence).to.equal(0xfffffffd)
  })

  it('leaves coins without a replay locktime untouched', async () => {
    const { psbtBase64 } = makeTx(makeTxArgs('bitcoin', false))
    const signedTx = await signTx({
      coin: 'bitcoin',
      feeInfo: bitcoin.engineInfo.defaultFeeInfo,
      privateKeyEncodings: [privateKeyEncoding],
      psbtBase64
    })
    const tx = Transaction.fromHex(signedTx.hex)

    expect(tx.locktime).to.equal(0)
    expect(tx.ins[0].sequence).to.equal(0xffffffff)
  })
})
