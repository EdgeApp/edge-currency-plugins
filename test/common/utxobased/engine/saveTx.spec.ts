import { assert } from 'chai'
import { makeMemoryDisklet, makeNodeDisklet } from 'disklet'
import {
  EdgeCorePluginOptions,
  EdgeCurrencyEngine,
  EdgeCurrencyEngineCallbacks,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyPlugin,
  EdgeCurrencyTools,
  EdgeTransaction,
  JsonObject,
  makeFakeIo
} from 'edge-core-js'
import { describe, it } from 'mocha'

import edgeCorePlugins from '../../../../src/index'
import { noOp, testLog } from '../../../util/testLog'
import { makeFakeNativeIo } from '../../../utils'
import { fixtures } from './engine.fixtures/index'

const [tests] = fixtures

/**
 * A transaction paying to an address that the dummy-data wallet owns
 * (scriptPubkey a9142244... with a bip49 path), spending a UTXO that the
 * dummy-data set holds (19e59364...:0). This makes saveTx's
 * getOwnUtxosFromTx return both a spent input and a new output, which drives
 * processUtxos -> processDataLayerUtxos -> updateProgressRatio.
 */
const OWN_SCRIPT_PUBKEY = 'a9142244ce86d664e85801f7eb2a56dd35afd268212587'
const SPENT_TXID =
  '19e59364daf34d97ed6584e9e978f3e2375adea9a4561a83d2066d92a010ba13'
const NEW_TXID =
  'f00dbabef00dbabef00dbabef00dbabef00dbabef00dbabef00dbabef00dbabe'
const SECOND_TXID =
  'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'

describe('saveTx on a disconnected engine', function () {
  it('resolves with zero subscribed addresses', async function () {
    this.timeout(10000)

    const fakeIo = makeFakeIo()
    const fixtureDisklet = makeNodeDisklet(tests.dummyDataPath)
    const fakeIoDisklet = makeMemoryDisklet()
    const nativeIo = makeFakeNativeIo()

    // Preload the wallet's data layer with the dummy dataset so the wallet
    // owns addresses and UTXOs:
    const migrate = async (dir: string): Promise<void> => {
      const files = await fixtureDisklet.list(dir)
      await Promise.all(
        Object.entries(files).map(async ([path, type]) => {
          if (type === 'folder') await migrate(path)
          if (type === 'file')
            await fixtureDisklet
              .getText(path)
              .then(async data => await fakeIoDisklet.setText(path, data))
        })
      )
    }
    await migrate('tables')

    const pluginOpts: EdgeCorePluginOptions = {
      initOptions: {},
      io: {
        ...fakeIo,
        random: () => Uint8Array.from(tests.key)
      },
      log: testLog,
      infoPayload: {},
      nativeIo,
      pluginDisklet: fakeIoDisklet
    }
    const factory = edgeCorePlugins[tests.pluginId]
    if (typeof factory !== 'function')
      throw new Error(`Missing plugin factory for ${tests.pluginId}`)
    const plugin = factory(pluginOpts) as EdgeCurrencyPlugin

    const tools: EdgeCurrencyTools = await plugin.makeCurrencyTools()
    const privateKeys = await tools.createPrivateKey(tests.WALLET_TYPE)
    Object.assign(privateKeys, { coinType: 0, format: tests.WALLET_FORMAT })
    const publicKeys = await tools.derivePublicKey({
      type: tests.WALLET_TYPE,
      keys: privateKeys,
      id: '!'
    })
    const keys: JsonObject = { ...privateKeys, ...publicKeys }

    // Track progress-side emissions: an engine that never ran a sync must
    // never report itself fully synced, and must never advance the seen-tx
    // checkpoint, no matter how many saveTx calls process UTXOs.
    const addressesCheckedRatios: number[] = []
    const seenTxCheckpoints: string[] = []
    const callbacks: EdgeCurrencyEngineCallbacks = {
      onAddressChanged: noOp,
      onAddressesChecked: (ratio: number) => {
        addressesCheckedRatios.push(ratio)
      },
      onBalanceChanged: noOp,
      onBlockHeightChanged: noOp,
      onNewTokens: noOp,
      onSeenTxCheckpoint: (checkpoint: string) => {
        seenTxCheckpoints.push(checkpoint)
      },
      onStakingStatusChanged: noOp,
      onTokenBalanceChanged: noOp,
      onTransactions: noOp,
      onTransactionsChanged: noOp,
      onTxidsChanged: noOp,
      onUnactivatedTokenIdsChanged: noOp,
      onWcNewContractCall: noOp
    }
    const engineOpts: EdgeCurrencyEngineOptions = {
      callbacks,
      log: testLog,
      walletLocalDisklet: fakeIoDisklet,
      walletLocalEncryptedDisklet: fakeIoDisklet,
      customTokens: {},
      enabledTokenIds: [],
      userSettings: {}
    }

    // The engine is never started, so nothing populates the address
    // subscribe cache (startEngine's initializeAddressSubscriptions and
    // setLookAhead are what fill it, network-free). A stopped engine is in
    // the same state: stop() clears the task cache. saveTx must still
    // resolve there.
    const engine: EdgeCurrencyEngine = await plugin.makeCurrencyEngine(
      { type: tests.WALLET_TYPE, keys, id: '!' },
      engineOpts
    )

    const scriptPubkeyBuffer = Buffer.from(OWN_SCRIPT_PUBKEY, 'hex')
    const edgeTx: EdgeTransaction = {
      blockHeight: 0,
      currencyCode: 'TESTBTC',
      date: 1723000000,
      isSend: true,
      memos: [],
      nativeAmount: '-50000',
      networkFee: '1000',
      networkFees: [],
      otherParams: {
        psbt: {
          base64: '',
          inputs: [
            {
              hash: Buffer.from(SPENT_TXID, 'hex').reverse(),
              index: 0,
              value: 16250000,
              scriptPubkey: scriptPubkeyBuffer,
              sequence: 0xffffffff
            }
          ],
          outputs: [
            {
              value: 16200000,
              scriptPubkey: scriptPubkeyBuffer
            }
          ]
        }
      },
      ourReceiveAddresses: [],
      signedTx: '0100000000',
      tokenId: null,
      txid: NEW_TXID,
      walletId: '!'
    }

    // The regression under test: updateProgressRatio used to throw
    // 'No addresses to process' here, failing saveTx AFTER the transaction
    // had already been saved and its inputs marked spent.
    await engine.saveTx(edgeTx)

    const txs = await engine.getTransactions({ tokenId: null })
    assert.isTrue(
      txs.some(tx => tx.txid === NEW_TXID),
      'saved transaction should be listed'
    )

    // A second saveTx spends the first transaction's output. The first
    // call's setLookAhead derived lookahead addresses into the subscribe
    // cache, so this call has a nonzero progress denominator; the first
    // call's denominator-less pass must not have counted as progress.
    const edgeTx2: EdgeTransaction = {
      ...edgeTx,
      otherParams: {
        psbt: {
          base64: '',
          inputs: [
            {
              hash: Buffer.from(NEW_TXID, 'hex').reverse(),
              index: 0,
              value: 16200000,
              scriptPubkey: scriptPubkeyBuffer,
              sequence: 0xffffffff
            }
          ],
          outputs: [
            {
              value: 16150000,
              scriptPubkey: scriptPubkeyBuffer
            }
          ]
        }
      },
      txid: SECOND_TXID
    }
    await engine.saveTx(edgeTx2)

    const txsAfterSecond = await engine.getTransactions({ tokenId: null })
    assert.isTrue(
      txsAfterSecond.some(tx => tx.txid === SECOND_TXID),
      'second saved transaction should be listed'
    )

    // Progress bookkeeping must not fabricate a completed sync out of
    // saveTx-driven processing: an engine that never synced must not emit a
    // fully-synced ratio and must not advance the seen-tx checkpoint.
    assert.notInclude(
      addressesCheckedRatios,
      1,
      'saveTx must not produce a fully-synced progress emission'
    )
    assert.isEmpty(
      seenTxCheckpoints,
      'saveTx must not advance the seen-tx checkpoint'
    )
  })
})
