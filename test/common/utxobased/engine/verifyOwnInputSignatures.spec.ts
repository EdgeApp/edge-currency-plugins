import secp256k1 from '@bitcoinerlab/secp256k1'
import { payments, script as bitcoinScript, Transaction } from 'altcoin-js'
import { expect } from 'chai'
import { makeMemoryDisklet } from 'disklet'
import { ECPairFactory } from 'ecpair'
import { EdgeTransaction } from 'edge-core-js/types'
import { describe, it } from 'mocha'

import { AddressPath } from '../../../../src/common/plugin/types'
import {
  DataLayer,
  makeDataLayer
} from '../../../../src/common/utxobased/db/DataLayer'
import { fromEdgeTransaction } from '../../../../src/common/utxobased/db/Models/TransactionData'
import {
  makeAddressData,
  TransactionData,
  UtxoData
} from '../../../../src/common/utxobased/db/types'
import { verifyOwnInputSignatures } from '../../../../src/common/utxobased/engine/util/verifyOwnInputSignatures'
import {
  currencyFormatToPurposeType,
  getScriptTypeFromPurposeType
} from '../../../../src/common/utxobased/engine/utils'
import {
  makeUtxoWalletTools,
  UtxoWalletTools
} from '../../../../src/common/utxobased/engine/UtxoWalletTools'
import { info as bitcoin } from '../../../../src/common/utxobased/info/bitcoin'
import {
  addressToScriptPubkey,
  BIP43PurposeTypeEnum,
  CannotVerifyInputError,
  makeTx,
  MakeTxArgs,
  ScriptTypeEnum,
  seedOrMnemonicToXPriv,
  signTx,
  verifyInputSignature,
  xprivToPrivateKey,
  xprivToXPub
} from '../../../../src/common/utxobased/keymanager/keymanager'

const ECPair = ECPairFactory(secp256k1)

// An address nobody here controls; the recipient in the spends below.
const RECIPIENT_ADDRESS = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu'
const RECIPIENT_SCRIPT = addressToScriptPubkey({
  address: RECIPIENT_ADDRESS,
  coin: 'bitcoin'
})
const PREV_TXID =
  '8b26fa4d0238788ffc3a7d96e4169acf6fe993a28791e9e748819ac216ee85b3'
const RBF_SEQUENCE = 0xfffffffd

interface Fixtures {
  dataLayer: DataLayer
  walletTools: UtxoWalletTools
  xprivs: { [format: string]: string }
}

const makeFixtures = async (): Promise<Fixtures> => {
  const seed = 'Ha/lqCZZCz+VWN2eGrHYuG/ag6S8w67rldgfCrlcPWI='
  const formats = {
    bip44: BIP43PurposeTypeEnum.Legacy,
    bip49: BIP43PurposeTypeEnum.WrappedSegwit,
    bip84: BIP43PurposeTypeEnum.Segwit
  } as const
  const xprivs: { [format: string]: string } = {}
  const publicKeys: { [format: string]: string } = {}
  for (const [format, type] of Object.entries(formats)) {
    xprivs[format] = seedOrMnemonicToXPriv({ seed, type, coin: 'bitcoin' })
    publicKeys[format] = xprivToXPub({
      xpriv: xprivs[format],
      type,
      coin: 'bitcoin'
    })
  }
  const walletTools = makeUtxoWalletTools({
    pluginInfo: bitcoin,
    publicKey: { publicKeys }
  })
  const dataLayer = await makeDataLayer({ disklet: makeMemoryDisklet() })
  // The wallet knows its first receive address of each format:
  for (const format of Object.keys(formats) as Array<keyof typeof formats>) {
    const path: AddressPath = { format, changeIndex: 0, addressIndex: 0 }
    const { scriptPubkey, redeemScript } = walletTools.getScriptPubkey(path)
    await dataLayer.saveAddress(
      makeAddressData({ scriptPubkey, redeemScript, path })
    )
  }
  return { dataLayer, walletTools, xprivs }
}

/** The UTXO the wallet holds on its first address of `format` */
const ownUtxo = (
  walletTools: UtxoWalletTools,
  format: 'bip44' | 'bip49' | 'bip84',
  value: string
): UtxoData => {
  const path: AddressPath = { format, changeIndex: 0, addressIndex: 0 }
  const { scriptPubkey, redeemScript } = walletTools.getScriptPubkey(path)
  const scriptType = getScriptTypeFromPurposeType(
    currencyFormatToPurposeType(format)
  )
  // Legacy inputs need the previous transaction hex; a minimal one paying
  // `value` to our script is enough for the signer:
  const prevTx = new Transaction()
  prevTx.addInput(Buffer.alloc(32), 0)
  prevTx.addOutput(Buffer.from(scriptPubkey, 'hex'), parseInt(value))
  const txid = format === 'bip44' ? prevTx.getId() : PREV_TXID
  return {
    id: `${txid}_0`,
    txid,
    vout: 0,
    value,
    scriptPubkey,
    script: format === 'bip44' ? prevTx.toHex() : scriptPubkey,
    redeemScript,
    scriptType,
    blockHeight: 1,
    spent: false
  }
}

/** Builds the DataLayer record a Blockbook sync would store for `hex` */
const transactionDataFromHex = (
  hex: string,
  inputScriptPubkeys: string[],
  inputValues: string[]
): TransactionData => {
  const tx = Transaction.fromHex(hex)
  return {
    txid: tx.getId(),
    hex,
    blockHeight: 0,
    date: 0,
    fees: '0',
    inputs: tx.ins.map((input, n) => ({
      n,
      txId: Buffer.from(input.hash).reverse().toString('hex'),
      outputIndex: input.index,
      sequence: input.sequence,
      scriptPubkey: inputScriptPubkeys[n],
      amount: inputValues[n]
    })),
    outputs: tx.outs.map((output, n) => ({
      n,
      scriptPubkey: output.script.toString('hex'),
      amount: String(output.value)
    })),
    ourIns: [],
    ourOuts: [],
    ourAmount: '0'
  }
}

/** A real spend from the wallet's `format` address, signed with its key */
const makeOwnSpend = async (
  fixtures: Fixtures,
  format: 'bip44' | 'bip49' | 'bip84'
): Promise<TransactionData> => {
  const { dataLayer, walletTools, xprivs } = fixtures
  const utxo = ownUtxo(walletTools, format, '100000')
  // The wallet holds the UTXO it is about to spend:
  await dataLayer.saveUtxo(utxo)
  const { psbtBase64 } = makeTx({
    forceUseUtxo: [utxo],
    utxos: [],
    targets: [{ address: RECIPIENT_ADDRESS, value: 40000 }],
    memos: [],
    feeRate: 1,
    enableRbf: true,
    coin: 'bitcoin',
    currencyCode: 'BTC',
    freshChangeAddress: walletTools.getAddress({
      format,
      changeIndex: 1,
      addressIndex: 0
    }).address,
    outputSort: 'bip69'
  })
  const privateKey = xprivToPrivateKey({
    xpriv: xprivs[format],
    type: currencyFormatToPurposeType(format),
    bip44ChangeIndex: 0,
    bip44AddressIndex: 0,
    coin: 'bitcoin'
  })
  const { hex } = await signTx({
    coin: 'bitcoin',
    feeInfo: bitcoin.engineInfo.defaultFeeInfo,
    privateKeyEncodings: [{ hex: privateKey, compressed: true }],
    psbtBase64
  })
  return transactionDataFromHex(hex, [utxo.scriptPubkey], [utxo.value])
}

/**
 * A transaction spending the wallet's bip84 UTXO to the recipient, with
 * change back to the wallet, and a witness made by whoever `signer` is (or
 * none at all), with the given signature hash type.
 */
const makeThirdPartySpend = (
  fixtures: Fixtures,
  signer: 'nobody' | 'other' | 'other-claiming-our-pubkey' | 'us',
  hashType: number = Transaction.SIGHASH_ALL
): TransactionData => {
  const { walletTools, xprivs } = fixtures
  const utxo = ownUtxo(walletTools, 'bip84', '100000')
  const tx = new Transaction()
  tx.version = 2
  tx.addInput(Buffer.from(utxo.txid, 'hex').reverse(), 0, RBF_SEQUENCE)
  tx.addOutput(Buffer.from(RECIPIENT_SCRIPT, 'hex'), 94000)
  tx.addOutput(Buffer.from(utxo.scriptPubkey, 'hex'), 5000)
  if (signer !== 'nobody') {
    const other =
      signer === 'us'
        ? ECPair.fromPrivateKey(
            Buffer.from(
              xprivToPrivateKey({
                xpriv: xprivs.bip84,
                type: BIP43PurposeTypeEnum.Segwit,
                bip44ChangeIndex: 0,
                bip44AddressIndex: 0,
                coin: 'bitcoin'
              }),
              'hex'
            )
          )
        : ECPair.makeRandom()
    const ourPubkey = Buffer.from(
      walletTools.getPubkey({
        format: 'bip84',
        changeIndex: 0,
        addressIndex: 0
      }),
      'hex'
    )
    const claimedPubkey = signer === 'other' ? other.publicKey : ourPubkey
    const p2wpkh = payments.p2wpkh({ pubkey: claimedPubkey })
    const scriptCode = payments.p2pkh({ hash: p2wpkh.hash }).output
    if (scriptCode == null) throw new Error('no script code')
    const sighash = tx.hashForWitnessV0(0, scriptCode, 100000, hashType)
    const signature = bitcoinScript.signature.encode(
      other.sign(sighash),
      hashType
    )
    tx.setWitness(0, [signature, claimedPubkey])
  }
  return transactionDataFromHex(tx.toHex(), [utxo.scriptPubkey], [utxo.value])
}

describe('verifyOwnInputSignatures', function () {
  this.timeout(10000)

  for (const format of ['bip44', 'bip49', 'bip84'] as const) {
    it(`accepts a ${format} spend the wallet signed`, async () => {
      const fixtures = await makeFixtures()
      const tx = await makeOwnSpend(fixtures, format)
      const result = await verifyOwnInputSignatures({
        ...fixtures,
        pluginInfo: bitcoin,
        tx
      })
      // The value of the spent output, as the signature or the previous
      // transaction proves it:
      expect(result).to.deep.equal({
        status: 'valid',
        ownInputValues: new Map([[0, 100000]])
      })
    })
  }

  it('reports proven input values, not the stored ones', async () => {
    const fixtures = await makeFixtures()
    const { dataLayer, walletTools } = fixtures
    const tx = await makeOwnSpend(fixtures, 'bip44')
    // A legacy signature does not commit to the value, so neither the record
    // nor the UTXO table proves it. The previous transaction, checked against
    // the outpoint, still says what the input is worth:
    tx.inputs[0].amount = '900000'
    const utxo = ownUtxo(walletTools, 'bip44', '100000')
    await dataLayer.saveUtxo({ ...utxo, value: '900000' })
    const result = await verifyOwnInputSignatures({
      ...fixtures,
      pluginInfo: bitcoin,
      tx
    })
    expect(result).to.deep.equal({
      status: 'valid',
      ownInputValues: new Map([[0, 100000]])
    })
  })

  it('rejects a Schnorr-shaped signature on a chain without a fork id', async () => {
    const fixtures = await makeFixtures()
    const tx = makeThirdPartySpend(fixtures, 'nobody')
    const parsed = Transaction.fromHex(tx.hex)
    const ourPubkey = Buffer.from(
      fixtures.walletTools.getPubkey({
        format: 'bip84',
        changeIndex: 0,
        addressIndex: 0
      }),
      'hex'
    )
    // 64 bytes of signature plus the hash-type byte, which is not DER.
    // Bitcoin takes no such signature in a segwit v0 input:
    parsed.setWitness(0, [
      Buffer.concat([Buffer.alloc(64, 1), Buffer.from([0x01])]),
      ourPubkey
    ])
    tx.hex = parsed.toHex()
    tx.txid = parsed.getId()
    const result = await verifyOwnInputSignatures({
      ...fixtures,
      pluginInfo: bitcoin,
      tx
    })
    expect(result.status).to.equal('invalid')
  })

  it('cannot judge a Schnorr signature on a chain that signs with a fork id', () => {
    const key = ECPair.makeRandom()
    const { output } = payments.p2pkh({ pubkey: key.publicKey })
    if (output == null) throw new Error('no script')
    const prevTx = new Transaction()
    prevTx.addInput(Buffer.alloc(32), 0)
    prevTx.addOutput(output, 100000)
    const makeSpend = (): Transaction => {
      const tx = new Transaction()
      tx.addInput(prevTx.getHash(), 0)
      tx.addOutput(output, 99000)
      // 64 bytes of signature plus the hash-type byte, which is not DER:
      tx.setInputScript(
        0,
        bitcoinScript.compile([
          Buffer.concat([Buffer.alloc(64, 1), Buffer.from([0x41])]),
          key.publicKey
        ])
      )
      return tx
    }
    const args = {
      inputIndex: 0,
      pubkey: key.publicKey.toString('hex'),
      scriptType: ScriptTypeEnum.p2pkh,
      value: 100000,
      prevTxHex: prevTx.toHex()
    }
    // Bitcoin Cash accepts Schnorr signatures in ordinary inputs, and the
    // validator cannot read one:
    expect(() =>
      verifyInputSignature({ ...args, tx: makeSpend(), coin: 'bitcoincash' })
    ).to.throw(CannotVerifyInputError)
    // Bitcoin does not, so the same input is simply not signed:
    expect(
      verifyInputSignature({ ...args, tx: makeSpend(), coin: 'bitcoin' })
    ).to.equal(false)
  })

  it('ignores a transaction that spends nothing of ours', async () => {
    const fixtures = await makeFixtures()
    const tx = await makeOwnSpend(fixtures, 'bip84')
    // The record attributes the input to another address, and the wallet
    // holds no such UTXO:
    tx.inputs[0].scriptPubkey = RECIPIENT_SCRIPT
    await fixtures.dataLayer.removeUtxos([`${tx.inputs[0].txId}_0`])
    const result = await verifyOwnInputSignatures({
      ...fixtures,
      pluginInfo: bitcoin,
      tx
    })
    expect(result.status).to.equal('none')
  })

  it('still checks a spend of our UTXO whose input is attributed elsewhere', async () => {
    const fixtures = await makeFixtures()
    const { dataLayer, walletTools } = fixtures
    // The wallet holds the UTXO the transaction spends:
    await dataLayer.saveUtxo(ownUtxo(walletTools, 'bip84', '100000'))
    const tx = makeThirdPartySpend(fixtures, 'nobody')
    tx.inputs[0].scriptPubkey = RECIPIENT_SCRIPT
    const result = await verifyOwnInputSignatures({
      ...fixtures,
      pluginInfo: bitcoin,
      tx
    })
    expect(result.status).to.equal('invalid')
  })

  it('rejects a spend of our UTXO with no signature', async () => {
    const fixtures = await makeFixtures()
    const tx = makeThirdPartySpend(fixtures, 'nobody')
    const result = await verifyOwnInputSignatures({
      ...fixtures,
      pluginInfo: bitcoin,
      tx
    })
    expect(result).to.deep.equal({
      status: 'invalid',
      reason: 'input 0 is not signed by this wallet'
    })
  })

  it('rejects a spend of our UTXO signed by another key', async () => {
    const fixtures = await makeFixtures()
    const tx = makeThirdPartySpend(fixtures, 'other')
    const result = await verifyOwnInputSignatures({
      ...fixtures,
      pluginInfo: bitcoin,
      tx
    })
    expect(result.status).to.equal('invalid')
  })

  it("rejects another key's signature presented under our pubkey", async () => {
    const fixtures = await makeFixtures()
    const tx = makeThirdPartySpend(fixtures, 'other-claiming-our-pubkey')
    const result = await verifyOwnInputSignatures({
      ...fixtures,
      pluginInfo: bitcoin,
      tx
    })
    expect(result.status).to.equal('invalid')
  })

  it('cannot judge a spend the wallet signed without SIGHASH_ALL', async () => {
    const fixtures = await makeFixtures()
    // The signature is the wallet's own, so its coins are being spent, but
    // this hash type does not commit to the outputs:
    const tx = makeThirdPartySpend(
      fixtures,
      'us',
      Transaction.SIGHASH_SINGLE | Transaction.SIGHASH_ANYONECANPAY
    )
    const result = await verifyOwnInputSignatures({
      ...fixtures,
      pluginInfo: bitcoin,
      tx
    })
    expect(result).to.deep.equal({
      status: 'unsupported',
      reason: 'Input is not signed with SIGHASH_ALL'
    })
  })

  it("rejects another key's signature whatever its hash type", async () => {
    const fixtures = await makeFixtures()
    const tx = makeThirdPartySpend(
      fixtures,
      'other-claiming-our-pubkey',
      Transaction.SIGHASH_NONE
    )
    const result = await verifyOwnInputSignatures({
      ...fixtures,
      pluginInfo: bitcoin,
      tx
    })
    expect(result).to.deep.equal({
      status: 'invalid',
      reason: 'input 0 is not signed by this wallet'
    })
  })

  describe('a segwit spend reported without its input value', function () {
    /** The wallet's own bip84 spend, as stored when no value was reported */
    const makeSpendWithoutValue = async (
      fixtures: Fixtures
    ): Promise<TransactionData> => {
      const tx = await makeOwnSpend(fixtures, 'bip84')
      // The UTXO record is gone, and the stored amount is the 0 that stands
      // in for a value the report left out:
      await fixtures.dataLayer.removeUtxos([`${tx.inputs[0].txId}_0`])
      tx.inputs[0].amount = '0'
      return tx
    }

    it('takes the value from the stored previous transaction', async () => {
      const fixtures = await makeFixtures()
      const tx = await makeSpendWithoutValue(fixtures)
      const utxo = ownUtxo(fixtures.walletTools, 'bip84', '100000')
      await fixtures.dataLayer.saveTransaction({
        tx: {
          txid: utxo.txid,
          hex: '',
          blockHeight: 1,
          date: 0,
          fees: '0',
          inputs: [],
          outputs: [
            { n: 0, scriptPubkey: utxo.scriptPubkey, amount: utxo.value }
          ],
          ourIns: [],
          ourOuts: [],
          ourAmount: utxo.value
        },
        scriptPubkeys: [utxo.scriptPubkey]
      })
      const result = await verifyOwnInputSignatures({
        ...fixtures,
        pluginInfo: bitcoin,
        tx
      })
      expect(result).to.deep.equal({
        status: 'valid',
        ownInputValues: new Map([[0, 100000]])
      })
    })

    it('does not accept the spend while the value is unknown', async () => {
      const fixtures = await makeFixtures()
      const tx = await makeSpendWithoutValue(fixtures)
      // A segwit signature commits to the value, so without one there is
      // nothing to check it against. The sync path sees the transaction
      // again on its next pass, by which time the previous transaction is
      // normally stored:
      const result = await verifyOwnInputSignatures({
        ...fixtures,
        pluginInfo: bitcoin,
        tx
      })
      expect(result).to.deep.equal({
        status: 'invalid',
        reason: 'input 0 is not signed by this wallet'
      })
    })
  })

  it('rejects a genuine transaction whose reported outputs were swapped', async () => {
    const fixtures = await makeFixtures()
    const tx = await makeOwnSpend(fixtures, 'bip84')
    // The hex and its signatures are real, but the stored record names a
    // different payee, which is what acceleration would rebuild from.
    const paidOutput = tx.outputs.find(
      output => output.scriptPubkey === RECIPIENT_SCRIPT
    )
    if (paidOutput == null) throw new Error('expected a paid output')
    paidOutput.amount = String(parseInt(paidOutput.amount) + 1)
    const result = await verifyOwnInputSignatures({
      ...fixtures,
      pluginInfo: bitcoin,
      tx
    })
    expect(result).to.deep.equal({
      status: 'invalid',
      reason: `output ${paidOutput.n} differs from hex`
    })
  })

  it('rejects a genuine transaction whose payee is reported twice', async () => {
    const fixtures = await makeFixtures()
    const tx = await makeOwnSpend(fixtures, 'bip84')
    // Every stored output matches the hex, and the count matches, but the
    // change output has been replaced by a second copy of the payee, which
    // acceleration would pay a second time.
    const paidOutput = tx.outputs.find(
      output => output.scriptPubkey === RECIPIENT_SCRIPT
    )
    if (paidOutput == null) throw new Error('expected a paid output')
    tx.outputs = tx.outputs.map(output =>
      output.scriptPubkey === RECIPIENT_SCRIPT ? output : { ...paidOutput }
    )
    const result = await verifyOwnInputSignatures({
      ...fixtures,
      pluginInfo: bitcoin,
      tx
    })
    expect(result).to.deep.equal({
      status: 'invalid',
      reason: `output ${paidOutput.n} is listed twice`
    })
  })

  it('rejects a genuine transaction reported under another txid', async () => {
    const fixtures = await makeFixtures()
    const tx = await makeOwnSpend(fixtures, 'bip84')
    tx.txid = PREV_TXID
    const result = await verifyOwnInputSignatures({
      ...fixtures,
      pluginInfo: bitcoin,
      tx
    })
    expect(result.status).to.equal('invalid')
  })

  it('rejects a genuine transaction whose reported input points elsewhere', async () => {
    const fixtures = await makeFixtures()
    const tx = await makeOwnSpend(fixtures, 'bip84')
    tx.inputs[0].outputIndex = 1
    const result = await verifyOwnInputSignatures({
      ...fixtures,
      pluginInfo: bitcoin,
      tx
    })
    expect(result).to.deep.equal({
      status: 'invalid',
      reason: 'input 0 differs from hex'
    })
  })

  it('cannot judge a transaction with no hex', async () => {
    const fixtures = await makeFixtures()
    const tx = await makeOwnSpend(fixtures, 'bip84')
    tx.hex = ''
    const result = await verifyOwnInputSignatures({
      ...fixtures,
      pluginInfo: bitcoin,
      tx
    })
    expect(result.status).to.equal('unsupported')
  })

  it('cannot judge a transaction whose hex does not parse', async () => {
    const fixtures = await makeFixtures()
    const tx = await makeOwnSpend(fixtures, 'bip84')
    tx.hex = 'deadbeef'
    const result = await verifyOwnInputSignatures({
      ...fixtures,
      pluginInfo: bitcoin,
      tx
    })
    expect(result.status).to.equal('unsupported')
  })

  // The cases above use the record a sync would store. A transaction the
  // wallet sends itself is stored from its own PSBT instead, and that record
  // is what `accelerate()` verifies in practice.
  describe('records the engine stores for its own sends', function () {
    /** A second bip84 UTXO, on the wallet's next receive address */
    const secondUtxo = async (fixtures: Fixtures): Promise<UtxoData> => {
      const { dataLayer, walletTools } = fixtures
      const path: AddressPath = {
        format: 'bip84',
        changeIndex: 0,
        addressIndex: 1
      }
      const { scriptPubkey, redeemScript } = walletTools.getScriptPubkey(path)
      await dataLayer.saveAddress(
        makeAddressData({ scriptPubkey, redeemScript, path })
      )
      const txid = PREV_TXID.replace(/^8b/, '9c')
      return {
        ...ownUtxo(walletTools, 'bip84', '50000'),
        id: `${txid}_0`,
        txid,
        scriptPubkey,
        script: scriptPubkey
      }
    }

    /** Builds, signs and stores a send the way the engine does */
    const engineSend = async (
      fixtures: Fixtures,
      args: Pick<MakeTxArgs, 'utxos' | 'forceUseUtxo' | 'targets'> &
        Partial<MakeTxArgs>
    ): Promise<TransactionData> => {
      const { dataLayer, walletTools, xprivs } = fixtures
      for (const utxo of [...args.utxos, ...args.forceUseUtxo]) {
        await dataLayer.saveUtxo(utxo)
      }
      const made = makeTx({
        memos: [],
        feeRate: 1,
        enableRbf: true,
        coin: 'bitcoin',
        currencyCode: 'BTC',
        freshChangeAddress: walletTools.getAddress({
          format: 'bip84',
          changeIndex: 1,
          addressIndex: 0
        }).address,
        outputSort: 'bip69',
        ...args
      })
      // One key per input, in the order the transaction lists them:
      const privateKeyEncodings = made.inputs.map(input => {
        const scriptPubkey = input.scriptPubkey.toString('hex')
        const addressIndex = [0, 1].find(
          addressIndex =>
            walletTools.getScriptPubkey({
              format: 'bip84',
              changeIndex: 0,
              addressIndex
            }).scriptPubkey === scriptPubkey
        )
        if (addressIndex == null) throw new Error('input is not ours')
        return {
          hex: xprivToPrivateKey({
            xpriv: xprivs.bip84,
            type: BIP43PurposeTypeEnum.Segwit,
            bip44ChangeIndex: 0,
            bip44AddressIndex: addressIndex,
            coin: 'bitcoin'
          }),
          compressed: true
        }
      })
      const { id, hex } = await signTx({
        coin: 'bitcoin',
        feeInfo: bitcoin.engineInfo.defaultFeeInfo,
        privateKeyEncodings,
        psbtBase64: made.psbtBase64
      })
      // What `saveTx` stores for a transaction this wallet broadcast:
      const edgeTx = {
        txid: id,
        signedTx: hex,
        blockHeight: 0,
        date: 0,
        networkFee: made.fee.toString(),
        nativeAmount: '0',
        otherParams: {
          psbt: {
            base64: made.psbtBase64,
            inputs: made.inputs,
            outputs: made.outputs
          }
        }
      }
      return fromEdgeTransaction((edgeTx as unknown) as EdgeTransaction)
    }

    it('accepts a max spend, and its replacement that pays the recipient less', async () => {
      const fixtures = await makeFixtures()
      const utxo = ownUtxo(fixtures.walletTools, 'bip84', '100000')
      const maxSpend = {
        utxos: [utxo],
        forceUseUtxo: [],
        targets: [{ address: RECIPIENT_ADDRESS, value: 100000 }],
        subtractFee: true
      }

      const original = await engineSend(fixtures, maxSpend)
      expect(original.outputs.length).to.equal(1) // everything, no change
      expect(
        await verifyOwnInputSignatures({
          ...fixtures,
          pluginInfo: bitcoin,
          tx: original
        })
      ).to.include({ status: 'valid' })

      // The replacement takes its higher fee out of the recipient's amount:
      const replacement = await engineSend(fixtures, {
        ...maxSpend,
        feeRate: 5
      })
      expect(parseInt(replacement.outputs[0].amount)).to.be.lessThan(
        parseInt(original.outputs[0].amount)
      )
      expect(
        await verifyOwnInputSignatures({
          ...fixtures,
          pluginInfo: bitcoin,
          tx: replacement
        })
      ).to.include({ status: 'valid' })
    })

    it('accepts a spend, and its replacement that adds an input to afford the fee', async () => {
      const fixtures = await makeFixtures()
      const utxo = ownUtxo(fixtures.walletTools, 'bip84', '100000')
      const other = await secondUtxo(fixtures)

      const original = await engineSend(fixtures, {
        utxos: [],
        forceUseUtxo: [utxo],
        targets: [{ address: RECIPIENT_ADDRESS, value: 99700 }]
      })
      expect(original.inputs.length).to.equal(1)
      expect(
        await verifyOwnInputSignatures({
          ...fixtures,
          pluginInfo: bitcoin,
          tx: original
        })
      ).to.include({ status: 'valid' })

      // At the higher fee rate the first input alone cannot pay the same
      // amount, so the replacement draws on a second UTXO:
      const replacement = await engineSend(fixtures, {
        utxos: [other],
        forceUseUtxo: [utxo],
        targets: [{ address: RECIPIENT_ADDRESS, value: 99700 }],
        feeRate: 10
      })
      expect(replacement.inputs.length).to.equal(2)
      expect(
        await verifyOwnInputSignatures({
          ...fixtures,
          pluginInfo: bitcoin,
          tx: replacement
        })
      ).to.include({ status: 'valid' })
    })

    it('accepts a two-input spend whose stored inputs are out of order', async () => {
      const fixtures = await makeFixtures()
      const utxo = ownUtxo(fixtures.walletTools, 'bip84', '100000')
      const other = await secondUtxo(fixtures)
      const tx = await engineSend(fixtures, {
        utxos: [other],
        forceUseUtxo: [utxo],
        targets: [{ address: RECIPIENT_ADDRESS, value: 120000 }]
      })
      expect(tx.inputs.length).to.equal(2)
      // Each entry keeps its own index; only the order of the list changes:
      tx.inputs.reverse()
      const result = await verifyOwnInputSignatures({
        ...fixtures,
        pluginInfo: bitcoin,
        tx
      })
      expect(result).to.include({ status: 'valid' })
    })
  })
})
