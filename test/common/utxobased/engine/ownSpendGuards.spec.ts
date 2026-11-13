import secp256k1 from '@bitcoinerlab/secp256k1'
import { payments, script as bitcoinScript, Transaction } from 'altcoin-js'
import { expect } from 'chai'
import { Disklet, makeMemoryDisklet } from 'disklet'
import { ECPairFactory } from 'ecpair'
import {
  EdgeCurrencyEngine,
  EdgeCurrencyEngineCallbacks,
  EdgeCurrencyPlugin,
  EdgeLog,
  EdgeTransaction,
  JsonObject
} from 'edge-core-js/types'

import { AddressPath } from '../../../../src/common/plugin/types'
import {
  DataLayer,
  makeDataLayer
} from '../../../../src/common/utxobased/db/DataLayer'
import {
  TransactionData,
  UtxoData
} from '../../../../src/common/utxobased/db/types'
import { processAddressForTransactions } from '../../../../src/common/utxobased/engine/UtxoEngineProcessor'
import {
  makeUtxoWalletTools,
  UtxoWalletTools
} from '../../../../src/common/utxobased/engine/UtxoWalletTools'
import { info as bitcoin } from '../../../../src/common/utxobased/info/bitcoin'
import {
  BIP43PurposeTypeEnum,
  makeTx,
  ScriptTypeEnum,
  seedOrMnemonicToXPriv,
  signTx,
  xprivToPrivateKey
} from '../../../../src/common/utxobased/keymanager/keymanager'
import edgeCorePlugins from '../../../../src/index'
import { noOp, testLog } from '../../../util/testLog'
import { makeFakeIo, makeFakeNativeIo } from '../../../utils'

const ECPair = ECPairFactory(secp256k1)

const WALLET_TYPE = 'wallet:bitcoin'
const WALLET_ID = '!'

// An address this wallet does not control; the recipient of the spends below.
const RECIPIENT_ADDRESS = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu'
const PREV_TXID =
  '8b26fa4d0238788ffc3a7d96e4169acf6fe993a28791e9e748819ac216ee85b3'
const OTHER_PREV_TXID =
  '9c26fa4d0238788ffc3a7d96e4169acf6fe993a28791e9e748819ac216ee85b3'
const RBF_SEQUENCE = 0xfffffffd
const UTXO_VALUE = 100000
const SEND_VALUE = 40000

// The wallet's first receive and change addresses:
const RECEIVE_PATH: AddressPath = {
  format: 'bip84',
  changeIndex: 0,
  addressIndex: 0
}
const CHANGE_PATH: AddressPath = {
  format: 'bip84',
  changeIndex: 1,
  addressIndex: 0
}

// The DataLayer writes through a cache that flushes to disk on a timer:
const FLUSH_WAIT_MS = 500

const snooze = async (ms: number): Promise<void> =>
  await new Promise(resolve => setTimeout(resolve, ms))

const callbacks: EdgeCurrencyEngineCallbacks = {
  onAddressChanged: noOp,
  onAddressesChecked: noOp,
  onBalanceChanged: noOp,
  onBlockHeightChanged: noOp,
  onNewTokens: noOp,
  onSeenTxCheckpoint: noOp,
  onStakingStatusChanged: noOp,
  onTokenBalanceChanged: noOp,
  onTransactions: noOp,
  onTransactionsChanged: noOp,
  onTxidsChanged: noOp,
  onUnactivatedTokenIdsChanged: noOp,
  onWcNewContractCall: noOp
}

/** The stored record a sync would build from a reported transaction */
const recordFromHex = (
  hex: string,
  inputs: Array<{ scriptPubkey: string; amount: string }>,
  fees: string = '0'
): TransactionData => {
  const tx = Transaction.fromHex(hex)
  return {
    txid: tx.getId(),
    hex,
    blockHeight: 0,
    date: 0,
    fees,
    inputs: tx.ins.map((input, n) => ({
      n,
      txId: Buffer.from(input.hash).reverse().toString('hex'),
      outputIndex: input.index,
      sequence: input.sequence,
      scriptPubkey: inputs[n].scriptPubkey,
      amount: inputs[n].amount
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

/** The transaction an engine is asked to accelerate */
const edgeTxFor = (record: TransactionData): EdgeTransaction => ({
  blockHeight: 0,
  currencyCode: 'BTC',
  date: 0,
  isSend: true,
  memos: [],
  nativeAmount: '0',
  networkFee: record.fees,
  networkFees: [],
  ourReceiveAddresses: [],
  signedTx: record.hex,
  tokenId: null,
  txid: record.txid,
  walletId: WALLET_ID
})

describe('own-spend guards in the engine', function () {
  this.timeout(20000)

  let plugin: EdgeCurrencyPlugin
  let keys: JsonObject
  let walletTools: UtxoWalletTools
  let privateKey: string
  let receiveScript: string
  let recipientScript: string

  before(async function () {
    const factory = edgeCorePlugins.bitcoin
    if (typeof factory !== 'function') {
      throw new Error('Missing the bitcoin plugin factory')
    }
    const corePlugin = factory({
      initOptions: {},
      io: makeFakeIo(),
      log: testLog,
      infoPayload: {},
      nativeIo: makeFakeNativeIo(),
      pluginDisklet: makeMemoryDisklet()
    })
    // The plugin factory returns the generic core plugin type:
    plugin = corePlugin as EdgeCurrencyPlugin
    const tools = await plugin.makeCurrencyTools()
    const privateKeys = await tools.createPrivateKey(WALLET_TYPE)
    const publicKeys = await tools.derivePublicKey({
      type: WALLET_TYPE,
      keys: privateKeys,
      id: WALLET_ID
    })
    keys = { ...privateKeys, ...publicKeys }

    walletTools = makeUtxoWalletTools({
      pluginInfo: bitcoin,
      publicKey: publicKeys as { publicKeys: { [format: string]: string } }
    })
    receiveScript = walletTools.getScriptPubkey(RECEIVE_PATH).scriptPubkey
    recipientScript = walletTools.addressToScriptPubkey(RECIPIENT_ADDRESS)
    privateKey = xprivToPrivateKey({
      xpriv: seedOrMnemonicToXPriv({
        seed: privateKeys.bitcoinKey,
        type: BIP43PurposeTypeEnum.Segwit,
        coinType: privateKeys.coinType,
        coin: 'bitcoin'
      }),
      type: BIP43PurposeTypeEnum.Segwit,
      bip44ChangeIndex: RECEIVE_PATH.changeIndex,
      bip44AddressIndex: RECEIVE_PATH.addressIndex,
      coin: 'bitcoin'
    })
    // The key derived here must be the one the engine's own address uses:
    expect(
      ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex')).publicKey.toString(
        'hex'
      )
    ).to.equal(walletTools.getPubkey(RECEIVE_PATH))
  })

  const makeEngine = async (
    walletLocalDisklet: Disklet,
    log: EdgeLog = testLog
  ): Promise<EdgeCurrencyEngine> =>
    await plugin.makeCurrencyEngine(
      { type: WALLET_TYPE, keys, id: WALLET_ID },
      {
        callbacks,
        log,
        walletLocalDisklet,
        walletLocalEncryptedDisklet: walletLocalDisklet,
        customTokens: {},
        enabledTokenIds: [],
        userSettings: {}
      }
    )

  /** A wallet disk whose engine has derived its first addresses */
  const makeWalletDisklet = async (): Promise<Disklet> => {
    const disklet = makeMemoryDisklet()
    const engine = await makeEngine(disklet)
    // The same initialization the core triggers when it loads a wallet:
    await engine.addGapLimitAddresses([])
    await snooze(FLUSH_WAIT_MS)
    return disklet
  }

  /** The UTXO the wallet holds on its first receive address */
  const ownUtxo = (): UtxoData => ({
    id: `${PREV_TXID}_0`,
    txid: PREV_TXID,
    vout: 0,
    value: String(UTXO_VALUE),
    scriptPubkey: receiveScript,
    script: receiveScript,
    scriptType: ScriptTypeEnum.p2wpkh,
    blockHeight: 1,
    spent: false
  })

  /** A spend of that UTXO the wallet made and signed itself */
  const makeOwnSpendHex = async (): Promise<string> => {
    const { psbtBase64 } = makeTx({
      forceUseUtxo: [ownUtxo()],
      utxos: [],
      targets: [{ address: RECIPIENT_ADDRESS, value: SEND_VALUE }],
      memos: [],
      feeRate: 1,
      enableRbf: true,
      coin: 'bitcoin',
      currencyCode: 'BTC',
      freshChangeAddress: walletTools.getAddress(CHANGE_PATH).address,
      outputSort: 'bip69'
    })
    const { hex } = await signTx({
      coin: 'bitcoin',
      feeInfo: bitcoin.engineInfo.defaultFeeInfo,
      privateKeyEncodings: [{ hex: privateKey, compressed: true }],
      psbtBase64
    })
    return hex
  }

  /**
   * A spend of that UTXO to the recipient with change back to the wallet,
   * and optionally a second input from elsewhere. The wallet's input is
   * signed by the wallet when `signed` is true and left bare otherwise.
   */
  const makeSpendHex = (opts: {
    signed: boolean
    extraInput?: boolean
  }): string => {
    const tx = new Transaction()
    tx.version = 2
    tx.addInput(Buffer.from(PREV_TXID, 'hex').reverse(), 0, RBF_SEQUENCE)
    if (opts.extraInput === true) {
      tx.addInput(
        Buffer.from(OTHER_PREV_TXID, 'hex').reverse(),
        0,
        RBF_SEQUENCE
      )
    }
    tx.addOutput(Buffer.from(recipientScript, 'hex'), SEND_VALUE)
    tx.addOutput(
      Buffer.from(walletTools.getScriptPubkey(CHANGE_PATH).scriptPubkey, 'hex'),
      UTXO_VALUE - SEND_VALUE - 200
    )
    if (opts.signed) {
      const key = ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'))
      const p2wpkh = payments.p2wpkh({ pubkey: key.publicKey })
      const scriptCode = payments.p2pkh({ hash: p2wpkh.hash }).output
      if (scriptCode == null) throw new Error('no script code')
      const sighash = tx.hashForWitnessV0(
        0,
        scriptCode,
        UTXO_VALUE,
        Transaction.SIGHASH_ALL
      )
      tx.setWitness(0, [
        bitcoinScript.signature.encode(
          key.sign(sighash),
          Transaction.SIGHASH_ALL
        ),
        key.publicKey
      ])
    }
    return tx.toHex()
  }

  const ownInput = { scriptPubkey: '', amount: String(UTXO_VALUE) }
  before(function () {
    ownInput.scriptPubkey = receiveScript
  })

  describe('accelerate()', function () {
    /**
     * Stores a record in a wallet and asks a fresh engine to accelerate it.
     * Returns the replacement along with the warnings the engine logged.
     */
    const accelerateStored = async (
      record: TransactionData
    ): Promise<{ replacement: EdgeTransaction | null; warnings: string[] }> => {
      const disklet = await makeWalletDisklet()
      const dataLayer = await makeDataLayer({ disklet })
      await dataLayer.saveUtxo(ownUtxo())
      await dataLayer.saveTransaction({
        tx: record,
        scriptPubkeys: [receiveScript]
      })
      await snooze(FLUSH_WAIT_MS)

      const warnings: string[] = []
      const log: EdgeLog = Object.assign(noOp, {
        breadcrumb: noOp,
        crash: noOp,
        error: noOp,
        warn: (message: string) => {
          warnings.push(message)
        }
      })
      const engine = await makeEngine(disklet, log)
      if (engine.accelerate == null) throw new Error('accelerate is missing')
      const replacement = await engine.accelerate(edgeTxFor(record))
      return { replacement, warnings }
    }

    it('builds a replacement for a spend the wallet signed', async function () {
      const record = recordFromHex(await makeOwnSpendHex(), [ownInput])

      const { replacement, warnings } = await accelerateStored(record)

      if (replacement == null) throw new Error('expected a replacement')
      expect(warnings).to.deep.equal([])
      expect(replacement.otherParams?.replacedTxid).to.equal(record.txid)
      expect(replacement.spendTargets).to.deep.equal([
        {
          currencyCode: 'BTC',
          nativeAmount: String(SEND_VALUE),
          publicAddress: RECIPIENT_ADDRESS,
          memo: undefined,
          uniqueIdentifier: undefined
        }
      ])
    })

    it('takes the replaced fee from the transaction, not the stored figure', async function () {
      const hex = await makeOwnSpendHex()
      const actualFee =
        UTXO_VALUE -
        Transaction.fromHex(hex).outs.reduce(
          (sum, output) => sum + output.value,
          0
        )
      // The stored fee is far above what the transaction really paid:
      const record = recordFromHex(hex, [ownInput], '50000')

      const { replacement } = await accelerateStored(record)

      if (replacement == null) throw new Error('expected a replacement')
      const newFee = parseInt(replacement.networkFee)
      expect(newFee).to.be.greaterThan(actualFee)
      expect(newFee).to.be.lessThan(actualFee * 4)
    })

    it('refuses a stored spend the wallet did not sign', async function () {
      const record = recordFromHex(makeSpendHex({ signed: false }), [ownInput])
      const { replacement, warnings } = await accelerateStored(record)
      expect(replacement).to.equal(null)
      expect(warnings).to.deep.equal([
        `accelerate: refusing ${record.txid}: invalid (input 0 is not signed by this wallet)`
      ])
    })

    it('refuses a stored spend it cannot verify', async function () {
      const record = recordFromHex(await makeOwnSpendHex(), [ownInput])
      // The record lost its hex, so there are no signatures to check:
      record.hex = ''
      const { replacement, warnings } = await accelerateStored(record)
      expect(replacement).to.equal(null)
      expect(warnings).to.deep.equal([
        `accelerate: refusing ${record.txid}: unsupported (transaction hex is missing)`
      ])
    })

    it("refuses a spend with an input that is not the wallet's", async function () {
      const record = recordFromHex(
        makeSpendHex({ signed: true, extraInput: true }),
        [ownInput, { scriptPubkey: recipientScript, amount: '50000' }]
      )
      const { replacement, warnings } = await accelerateStored(record)
      expect(replacement).to.equal(null)
      expect(warnings).to.deep.equal([
        `accelerate: refusing ${record.txid}: foreign inputs`
      ])
    })
  })

  describe('address sync', function () {
    type CommonParams = Parameters<typeof processAddressForTransactions>[0]

    /** What a server reports for a transaction, built from its hex */
    const reportFor = (
      hex: string,
      opts: { blockHeight: number }
    ): JsonObject => {
      const tx = Transaction.fromHex(hex)
      return {
        txid: tx.getId(),
        hex,
        blockHeight: opts.blockHeight,
        confirmations: opts.blockHeight > 0 ? 1 : 0,
        blockTime: 0,
        fees: '0',
        vin: tx.ins.map((input, n) => ({
          addresses: [walletTools.getAddress(RECEIVE_PATH).address],
          n,
          sequence: input.sequence,
          txid: Buffer.from(input.hash).reverse().toString('hex'),
          value: String(UTXO_VALUE),
          vout: input.index
        })),
        vout: tx.outs.map((output, n) => ({
          n,
          value: String(output.value),
          addresses: [],
          hex: output.script.toString('hex')
        }))
      }
    }

    /** Runs one address query that reports the given transactions */
    const syncAddress = async (
      reports: JsonObject[]
    ): Promise<{ dataLayer: DataLayer; warnings: string[] }> => {
      const disklet = await makeWalletDisklet()
      const dataLayer = await makeDataLayer({ disklet })
      await dataLayer.saveUtxo(ownUtxo())

      const warnings: string[] = []
      const address = walletTools.getAddress(RECEIVE_PATH).address
      const fakeCommon = {
        dataLayer,
        emitter: { emit: noOp },
        log: Object.assign(noOp, {
          warn: (message: string) => warnings.push(message),
          error: noOp
        }),
        maxSeenTxBlockHeight: 0,
        pluginInfo: bitcoin,
        seenTxCheckpoint: () => undefined,
        serverStates: {
          // The query resolves at once with the report:
          addressQueryTask: async function* () {
            return {
              transactions: reports,
              txs: reports.length,
              unconfirmedTxs: reports.length,
              // More pages to come, so the pass stops after saving this one:
              totalPages: 2
            }
          }
        },
        taskCache: { addressForTransactionsCache: {} },
        updateSeenTxCheckpoint: noOp,
        walletInfo: { id: WALLET_ID },
        walletTools
      }
      // Only the parts processAddressForTransactions reads for one page:
      const common = (fakeCommon as unknown) as CommonParams
      const args = {
        address,
        cacheItem: { processing: true, path: RECEIVE_PATH, blockHeight: 0 },
        serverState: { blockHeight: 0, addresses: new Set<string>() },
        serverUri: 'wss://blockbook.example.com/websocket'
      }
      const task = processAddressForTransactions(
        common,
        (args as unknown) as Parameters<typeof processAddressForTransactions>[1]
      )
      let step = await task.next()
      while (step.done !== true) step = await task.next()
      expect(step.value).to.equal(true)
      return { dataLayer, warnings }
    }

    const isStored = async (
      dataLayer: DataLayer,
      hex: string
    ): Promise<boolean> => {
      const [stored] = await dataLayer.fetchTransactions({
        txId: Transaction.fromHex(hex).getId()
      })
      return stored != null
    }

    it('records an unconfirmed spend the wallet signed', async function () {
      const hex = await makeOwnSpendHex()
      const { dataLayer, warnings } = await syncAddress([
        reportFor(hex, { blockHeight: 0 })
      ])
      expect(await isStored(dataLayer, hex)).to.equal(true)
      expect(warnings).to.deep.equal([])
    })

    it('does not record an unconfirmed spend the wallet did not sign', async function () {
      const hex = makeSpendHex({ signed: false })
      const { dataLayer, warnings } = await syncAddress([
        reportFor(hex, { blockHeight: 0 })
      ])
      expect(await isStored(dataLayer, hex)).to.equal(false)
      expect(warnings.length).to.equal(1)
      expect(warnings[0]).to.match(/Ignoring unconfirmed transaction/)
    })

    it('records a confirmed spend without checking it', async function () {
      const hex = makeSpendHex({ signed: false })
      const { dataLayer, warnings } = await syncAddress([
        reportFor(hex, { blockHeight: 800000 })
      ])
      expect(await isStored(dataLayer, hex)).to.equal(true)
      expect(warnings).to.deep.equal([])
    })
  })
})
