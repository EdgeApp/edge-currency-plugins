/* eslint-disable @typescript-eslint/no-empty-function */
import { assert } from 'chai'
import { downgradeDisklet, navigateDisklet } from 'disklet'
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
import { fixtures } from './engine.fixtures/index'

const fetchHack: EdgeFetchFunction = fetch as any

const fakeLogger = {
  info: noOp,
  warn: noOp,
  error: noOp
}

const DATA_STORE_FOLDER = 'txEngineFolderBTC'

for (const fixture of fixtures) {
  const {
    tests,
    dummyAddressData,
    dummyHeadersData,
    dummyTransactionsData
  } = fixture

  const WALLET_FORMAT = tests.WALLET_FORMAT
  const WALLET_TYPE = tests.WALLET_TYPE
  const TX_AMOUNT = tests.TX_AMOUNT

  let engine: EdgeCurrencyEngine
  let keys: JsonObject = {}

  const fakeIo = makeFakeIo()
  const pluginOpts: EdgeCorePluginOptions = {
    initOptions: {},
    io: {
      ...fakeIo,
      random: () => Uint8Array.from(tests.key),
      fetch: fetchHack
    },
    log: testLog,
    nativeIo: {},
    pluginDisklet: fakeIo.disklet
  }
  const factory = edgeCorePlugins[tests.pluginId]
  if (typeof factory !== 'function') {
    // Skip this test if the plugin is not available
    break
    // throw new TypeError('Bad plugin')
  }
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
    onTransactionsChanged(transactionList) {
      fakeLogger.info('onTransactionsChanged:', transactionList)
      emitter.emit('onTransactionsChanged', transactionList)
    },
    onTxidsChanged() {}
  }

  const walletLocalDisklet = navigateDisklet(fakeIo.disklet, DATA_STORE_FOLDER)
  const walletLocalFolder = downgradeDisklet(walletLocalDisklet)
  const engineOpts: EdgeCurrencyEngineOptions = {
    callbacks,
    log: testLog,
    walletLocalDisklet,
    walletLocalEncryptedDisklet: walletLocalDisklet,
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
      keys = await tools.createPrivateKey(WALLET_TYPE)
      Object.assign(keys, {
        coinType: 0,
        format: WALLET_FORMAT
      })
      keys = await tools.derivePublicKey({
        type: WALLET_TYPE,
        keys,
        id: '!'
      })
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
          assert.equal(e.message, 'Either a public or private key are required')
        })
    })

    it('Error when Making Engine without key', async function () {
      return await plugin
        .makeCurrencyEngine(
          { type: WALLET_TYPE, keys: { ninjaXpub: keys.pub }, id: '!' },
          engineOpts
        )
        .catch(e => {
          assert.equal(e.message, 'Either a public or private key are required')
        })
    })
  })
  describe(`Start Engine for Wallet type ${WALLET_TYPE}`, function () {
    before('Create local cache file', async function () {
      await walletLocalFolder
        .file('addresses.json')
        .setText(JSON.stringify(dummyAddressData))
        .then(
          async () =>
            await walletLocalFolder
              .file('txs.json')
              .setText(JSON.stringify(dummyTransactionsData))
        )
        .then(
          async () =>
            await walletLocalFolder
              .file('headers.json')
              .setText(JSON.stringify(dummyHeadersData))
        )
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
          assert.equal(typeof engine.isAddressUsed, 'function', 'isAddressUsed')
          assert.equal(typeof engine.makeSpend, 'function', 'makeSpend')
          assert.equal(typeof engine.signTx, 'function', 'signTx')
          assert.equal(typeof engine.broadcastTx, 'function', 'broadcastTx')
          assert.equal(typeof engine.saveTx, 'function', 'saveTx')
          return true
        })
    })
  })

  describe.skip(`Is Address Used for Wallet type ${WALLET_TYPE} from cache`, function () {
    const testCases = tests['Address used from cache']
    const wrongFormat = testCases.wrongFormat ?? []
    const notInWallet = testCases.notInWallet ?? []
    const empty = testCases.empty ?? {}
    const nonEmpty = testCases.nonEmpty ?? {}

    wrongFormat.forEach(address => {
      it('Checking a wrong formated address', async function (done) {
        try {
          await engine.isAddressUsed(address)
        } catch (e) {
          assert(e, 'Should throw')
          assert.equal(e.message, 'Wrong formatted address')
          done()
        }
      })
    })

    notInWallet.forEach(address => {
      it("Checking an address we don't own", function () {
        try {
          assert.equal(engine.isAddressUsed(address), false)
        } catch (e) {
          assert(e, 'Should throw')
          assert.equal(e.message, 'Address not found in wallet')
        }
      })
    })

    objectKeys(empty).forEach(test => {
      it(`Checking an empty ${test}`, function (done) {
        assert.equal(engine.isAddressUsed(empty[test]), false)
        done()
      })
    })

    objectKeys(nonEmpty).forEach(test => {
      it(`Checking a non empty ${test}`, function (done) {
        assert.equal(engine.isAddressUsed(nonEmpty[test]), true)
        done()
      })
    })
  })

  describe.skip(`Get Transactions from Wallet type ${WALLET_TYPE}`, function () {
    it('Should get number of transactions from cache', function () {
      assert.equal(
        engine.getNumTransactions({}),
        TX_AMOUNT,
        `should have ${TX_AMOUNT} tx from cache`
      )
    })

    it('Should get transactions from cache', async function () {
      await engine.getTransactions({}).then(txs => {
        assert.equal(
          txs.length,
          TX_AMOUNT,
          `should have ${TX_AMOUNT} tx from cache`
        )
      })
    })

    it('Should get transactions from cache with options', async function () {
      await engine
        .getTransactions({ startIndex: 1, startEntries: 2 })
        .then(txs => {
          assert.equal(txs.length, 2, 'should have 2 tx from cache')
        })
    })
  })

  describe.skip('Should Add Gap Limit Addresses', function () {
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
      engine.getDisplayPrivateSeed()
      done()
    })
    it('get public key', function (done) {
      engine.getDisplayPublicSeed()
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
      const processor = await makeProcessor({
        disklet: engineOpts.walletLocalDisklet
      })

      const txs = await processor.fetchTransactions({ blockHeight: 0 })

      // $FlowFixMe
      const engineState: any = engine.engineState
      const scriptHash = engineState.scriptHashes[address.publicAddress]
      const transactions = engineState.addressInfos[scriptHash].txids
      assert(transactions.length === 0, 'Should have never received coins')
    })
  })
  */

  describe.skip(`Make Spend and Sign for Wallet type ${WALLET_TYPE}`, function () {
    const spendTests = tests.Spend ?? {}
    const insufficientTests = tests.InsufficientFundsError ?? {}

    it('Should fail since no spend target is given', async function () {
      const spendInfo: EdgeSpendInfo = {
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
            return await engine.signTx(a)
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
          return await engine.signTx(a)
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
        dataDump.data.walletInfo.primaryFormat === WALLET_FORMAT,
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
