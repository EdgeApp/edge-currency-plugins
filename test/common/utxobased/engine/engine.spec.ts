/* eslint-disable @typescript-eslint/no-empty-function */
import { assert } from 'chai'
import { makeMemoryDisklet, makeNodeDisklet } from 'disklet'
import {
  asMaybeInsufficientFundsError,
  EdgeCorePlugin,
  EdgeCorePluginOptions,
  EdgeCurrencyEngine,
  EdgeCurrencyEngineCallbacks,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyPlugin,
  EdgeCurrencyTools,
  EdgeFetchFunction,
  EdgeSpendInfo,
  JsonObject,
  makeFakeIo
} from 'edge-core-js'
import EventEmitter from 'events'
import fetch from 'node-fetch'
import request from 'request'

import edgeCorePlugins from '../../../../src/index'
import { objectKeys } from '../../../util/objectKeys'
import { noOp, testLog } from '../../../util/testLog'
import { makeFakeNativeIo } from '../../../utils'
import { fixtures } from './engine.fixtures/index'

const fetchHack: EdgeFetchFunction = fetch as any

const fakeLogger = {
  info: noOp,
  warn: noOp,
  error: noOp
}

describe('engine.spec', function () {
  for (const tests of fixtures) {
    const WALLET_FORMAT = tests.WALLET_FORMAT
    const WALLET_TYPE = tests.WALLET_TYPE
    const TX_AMOUNT = tests.TX_AMOUNT

    let engine: EdgeCurrencyEngine
    let keys: JsonObject = {}

    const fakeIo = makeFakeIo()
    const fixtureDisklet = makeNodeDisklet(tests.dummyDataPath)
    const fakeIoDisklet = makeMemoryDisklet()
    const nativeIo = makeFakeNativeIo()
    // FOR DEBUGGING:
    // const fakeIoDisklet = makeNodeDisklet(
    //   join(__dirname, 'engine.fixtures/bitcoinTestnet2')
    // )

    const pluginOpts: EdgeCorePluginOptions = {
      initOptions: {},
      io: {
        ...fakeIo,
        random: () => Uint8Array.from(tests.key),
        fetch: fetchHack
      },
      log: testLog,
      infoPayload: {},
      nativeIo,
      pluginDisklet: fakeIoDisklet
    }
    const factory = edgeCorePlugins[tests.pluginId]

    // Skip this test if the plugin is not available
    if (typeof factory !== 'function') break

    const corePlugin: EdgeCorePlugin = factory(pluginOpts)
    const plugin: EdgeCurrencyPlugin = corePlugin as any

    const emitter = new EventEmitter()
    const callbacks: EdgeCurrencyEngineCallbacks = {
      onAddressChanged() {},
      onAddressesChecked(progressRatio) {
        fakeLogger.info('onAddressesCheck', progressRatio)
        emitter.emit('onAddressesCheck', progressRatio)
      },
      onBalanceChanged(currencyCode, balance) {
        fakeLogger.info('onBalanceChange:', currencyCode, balance)
        emitter.emit('onBalanceChange', currencyCode, balance)
      },
      onBlockHeightChanged(height) {
        fakeLogger.info('onBlockHeightChange:', height)
        emitter.emit('onBlockHeightChange', height)
      },
      onNewTokens() {},
      onSeenTxCheckpoint() {},
      onStakingStatusChanged() {},
      onTokenBalanceChanged() {},
      onTransactions(transactionEvents) {
        fakeLogger.info('onTransactions:', transactionEvents)
        emitter.emit('onTransactions', transactionEvents)
      },
      onTransactionsChanged(transactionList) {
        fakeLogger.info('onTransactionsChanged:', transactionList)
        emitter.emit('onTransactionsChanged', transactionList)
      },
      onTxidsChanged() {},
      onUnactivatedTokenIdsChanged() {},
      onWcNewContractCall() {}
    }

    const walletLocalDisklet = fakeIoDisklet
    const engineOpts: EdgeCurrencyEngineOptions = {
      callbacks,
      log: testLog,
      walletLocalDisklet,
      walletLocalEncryptedDisklet: walletLocalDisklet,
      customTokens: {},
      enabledTokenIds: [],
      userSettings: tests.ChangeSettings
    }

    describe(`Engine Creation Errors for Wallet type ${WALLET_TYPE}`, function () {
      before('Plugin', async function () {
        assert.equal(
          plugin.currencyInfo.currencyCode,
          tests['Test Currency code']
        )
        const tools: EdgeCurrencyTools = await plugin.makeCurrencyTools()
        // Hack for now until we change all the dummy data to represent the new derivation path
        const privateKeys = await tools.createPrivateKey(WALLET_TYPE)
        Object.assign(privateKeys, {
          coinType: 0,
          format: WALLET_FORMAT
        })
        const publicKeys = await tools.derivePublicKey({
          type: WALLET_TYPE,
          keys: privateKeys,
          id: '!'
        })

        keys = { ...privateKeys, ...publicKeys }
      })

      it('Error when Making Engine without local folder', async function () {
        return await plugin
          .makeCurrencyEngine({ type: WALLET_TYPE, keys, id: '!' }, engineOpts)
          .catch(e => {
            assert.equal(
              e.message,
              'Cannot create an engine without a local folder'
            )
          })
      })

      it('Error when Making Engine without keys', async function () {
        return await plugin
          .makeCurrencyEngine(
            { type: WALLET_TYPE, keys: {}, id: '!' },
            engineOpts
          )
          .catch(e => {
            assert.equal(
              e.message,
              'Either a public or private key are required'
            )
          })
      })

      it('Error when Making Engine without key', async function () {
        return await plugin
          .makeCurrencyEngine(
            { type: WALLET_TYPE, keys: { ninjaXpub: keys.pub }, id: '!' },
            engineOpts
          )
          .catch(e => {
            assert.equal(
              e.message,
              'Either a public or private key are required'
            )
          })
      })
    })
    describe(`Start Engine for Wallet type ${WALLET_TYPE}`, function () {
      before('Create local cache', async function () {
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
      })

      it('Make Engine', async function () {
        const { id, userSettings } = tests['Make Engine']
        return await plugin
          .makeCurrencyEngine(
            { type: WALLET_TYPE, keys, id },
            { ...engineOpts, userSettings }
          )
          .then(e => {
            engine = e
            assert.equal(typeof engine.startEngine, 'function', 'startEngine')
            assert.equal(typeof engine.killEngine, 'function', 'killEngine')
            // assert.equal(typeof engine.enableTokens, 'function', 'enableTokens')
            assert.equal(
              typeof engine.getBlockHeight,
              'function',
              'getBlockHeight'
            )
            assert.equal(typeof engine.getBalance, 'function', 'getBalance')
            assert.equal(
              typeof engine.getNumTransactions,
              'function',
              'getNumTransactions'
            )
            assert.equal(
              typeof engine.getTransactions,
              'function',
              'getTransactions'
            )
            assert.equal(
              typeof engine.getFreshAddress,
              'function',
              'getFreshAddress'
            )
            assert.equal(
              typeof engine.addGapLimitAddresses,
              'function',
              'addGapLimitAddresses'
            )
            assert.equal(
              typeof engine.isAddressUsed,
              'function',
              'isAddressUsed'
            )
            assert.equal(typeof engine.makeSpend, 'function', 'makeSpend')
            assert.equal(typeof engine.signTx, 'function', 'signTx')
            assert.equal(typeof engine.broadcastTx, 'function', 'broadcastTx')
            assert.equal(typeof engine.saveTx, 'function', 'saveTx')
            return true
          })
      })
    })

    describe(`Is Address Used for Wallet type ${WALLET_TYPE} from cache`, function () {
      const testCases = tests['Address used from cache']
      const wrongFormat = testCases.wrongFormat ?? []
      const notInWallet = testCases.notInWallet ?? []
      const empty = testCases.empty ?? {}
      const nonEmpty = testCases.nonEmpty ?? {}

      wrongFormat.forEach(address => {
        it('Checking a wrong formated address', async function () {
          try {
            await engine.isAddressUsed(address)
          } catch (e: any) {
            assert(e, 'Should throw')
            assert.match(
              e.message,
              /unable to convert address \w+ to script pubkey/
            )
          }
        })
      })

      notInWallet.forEach(address => {
        it("Checking an address we don't own", async function () {
          try {
            assert.equal(await engine.isAddressUsed(address), false)
          } catch (e: any) {
            assert(e, 'Should throw')
            assert.equal(e.message, 'Address not found in wallet')
          }
        })
      })

      objectKeys(empty).forEach(test => {
        it(`Checking an empty ${test}`, async function () {
          assert.equal(await engine.isAddressUsed(empty[test]), false)
        })
      })

      objectKeys(nonEmpty).forEach(test => {
        it(`Checking a non empty ${test}`, async function () {
          assert.equal(await engine.isAddressUsed(nonEmpty[test]), true)
        })
      })
    })

    describe(`Get Transactions from Wallet type ${WALLET_TYPE}`, function () {
      it('Should get number of transactions from cache', function () {
        assert.equal(
          engine.getNumTransactions({ tokenId: null }),
          TX_AMOUNT,
          `should have ${TX_AMOUNT} tx from cache`
        )
      })

      it('Should get transactions from cache', async function () {
        await engine.getTransactions({ tokenId: null }).then(txs => {
          assert.equal(
            txs.length,
            TX_AMOUNT,
            `should have ${TX_AMOUNT} tx from cache`
          )
        })
      })
    })

    describe('Should Add Gap Limit Addresses', function () {
      const gapAddresses = tests['Add Gap Limit']
      const derived = gapAddresses.derived ?? []
      // const future = gapAddresses.future ?? []

      it('Add Empty Array', async function () {
        await engine.addGapLimitAddresses([])
      })

      it('Add Already Derived Addresses', async function () {
        await engine.addGapLimitAddresses(derived)
      })

      // it('Add Future Addresses', function () {
      //   await engine.addGapLimitAddresses(future)
      // })
    })

    describe('Should start engine', function () {
      it.skip('Get BlockHeight', function (done) {
        const { uri, defaultHeight } = tests.BlockHeight
        this.timeout(3000)
        const testHeight = (): void => {
          emitter.on('onBlockHeightChange', height => {
            if (height >= heightExpected) {
              emitter.removeAllListeners('onBlockHeightChange')
              assert(engine.getBlockHeight() >= heightExpected, 'Block height')
              done() // Can be "done" since the promise resolves before the event fires but just be on the safe side
            }
          })
          engine.startEngine().catch(e => {
            fakeLogger.info('startEngine error', e, e.message)
          })
        }
        let heightExpected = defaultHeight
        if (uri !== '') {
          request.get(uri, (err, _res, body) => {
            assert(err != null, 'getting block height from a second source')
            const thirdPartyHeight = parseInt(JSON.parse(body).height)
            if (thirdPartyHeight !== 0 && !isNaN(thirdPartyHeight)) {
              heightExpected = thirdPartyHeight
            }
            testHeight()
          })
        } else {
          testHeight()
        }
      })
    })

    describe(`Get Wallet Keys for Wallet type ${WALLET_TYPE}`, function () {
      it('get private key', function (done) {
        if (engine.getDisplayPrivateSeed != null) {
          engine.getDisplayPrivateSeed(keys)
        }
        done()
      })
      it('get public key', function (done) {
        if (engine.getDisplayPublicSeed != null) {
          engine.getDisplayPublicSeed()
        }
        done()
      })
    })

    // describe(`Is Address Used for Wallet type ${WALLET_TYPE} from network`, function () {
    //   it('Checking a non empty P2WSH address', function (done) {
    //     setTimeout(() => {
    //       assert.equal(engine.isAddressUsed('tb1qzsqz3akrp8745gsrl45pa2370gculzwx4qcf5v'), true)
    //       done()
    //     }, 1000)
    //   })

    //   it('Checking a non empty address P2SH', function (done) {
    //     setTimeout(() => {
    //       assert.equal(engine.isAddressUsed('2MtegHVwZFy88UjdHU81wWiRkwDq5o8pWka'), true)
    //       done()
    //     }, 1000)
    //   })
    // })

    /* TODO
  describe(`Get Fresh Address for Wallet type ${WALLET_TYPE}`, function () {
    it('Should provide a non used BTC address when no options are provided', async function () {
      this.timeout(3000)
      const address = await engine.getFreshAddress({}) // TODO
      const dataLayer = await makeDataLayer({
        disklet: engineOpts.walletLocalDisklet
      })

      const txs = await dataLayer.fetchTransactions({ blockHeight: 0 })

      // $FlowFixMe
      const engineProcessor: any = engine.engineProcessor
      const scriptHash = engineProcessor.scriptHashes[address.publicAddress]
      const transactions = engineProcessor.addressInfos[scriptHash].txids
      assert(transactions.length === 0, 'Should have never received coins')
    })
  })
  */

    describe(`Make Spend and Sign for Wallet type ${WALLET_TYPE}`, function () {
      const spendTests = tests.Spend ?? {}
      const insufficientTests = tests.InsufficientFundsError ?? {}

      it('Should fail since no spend target is given', async function () {
        const spendInfo: EdgeSpendInfo = {
          tokenId: null,
          networkFeeOption: 'high',
          metadata: {
            name: 'Transfer to College Fund',
            category: 'Transfer:Wallet:College Fund'
          },
          spendTargets: []
        }
        return await engine.makeSpend(spendInfo).catch(e => {
          assert(e, 'Should throw')
        })
      })

      objectKeys(spendTests).forEach(test => {
        it(`Should build transaction with ${test}`, async function () {
          this.timeout(3000)
          const templateSpend = spendTests[test]
          return await engine
            .makeSpend(templateSpend)
            .then(async a => {
              return await engine.signTx(a, keys)
            })
            .then(a => {
              fakeLogger.info('sign', a)
            })
        })
      })

      objectKeys(insufficientTests).forEach(test => {
        it(`Should throw InsufficientFundsError for ${test}`, async function () {
          const templateSpend: EdgeSpendInfo = insufficientTests[test]
          return await engine
            .makeSpend(templateSpend)
            .catch(e => assert.isOk(asMaybeInsufficientFundsError(e)))
        })
      })
    })

    describe(`Sweep Keys and Sign for Wallet type ${WALLET_TYPE}`, function () {
      const sweepTests = tests.Sweep ?? {}

      objectKeys(sweepTests).forEach(test => {
        it.skip(`Should build transaction with ${test}`, async function () {
          this.timeout(5000)
          const templateSpend: EdgeSpendInfo = sweepTests[test]
          if (engine.sweepPrivateKeys == null) {
            throw new Error('No sweepPrivateKeys')
          }
          return await engine.sweepPrivateKeys(templateSpend).then(async a => {
            return await engine.signTx(a, keys)
          })
          // .then(a => {
          // console.warn('sign', a)
          // })
        })
      })
    })

    describe(`Stop Engine for Wallet type ${WALLET_TYPE}`, function () {
      it('dump the wallet data', async function () {
        const dataDump = await engine.dumpData()
        const { id } = tests['Make Engine']
        assert(dataDump.walletId === id, 'walletId')
        assert(dataDump.walletType === WALLET_TYPE, 'walletType')
        assert(
          dataDump.data.walletInfo.privateKeyFormat === WALLET_FORMAT,
          'walletFormat'
        )
      })

      it('changeSettings', async function () {
        await engine.changeUserSettings(tests.ChangeSettings)
      })

      it('Stop the engine', async function () {
        fakeLogger.info('kill engine')
        await engine.killEngine()
      })
    })
  }
})
