// @flow

import { assert, expect } from 'chai'
import { navigateDisklet } from 'disklet'
import {
  EdgeCorePlugin,
  EdgeCorePluginOptions,
  EdgeCurrencyEngine,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyPlugin,
  EdgeCurrencyTools,
  JsonObject,
  makeFakeIo
} from 'edge-core-js'
import EventEmitter from 'events'
// import { readdirSync, statSync } from 'fs'
// import { readFileSync } from 'jsonfile'
import { before, describe, it } from 'mocha'

// import fetch from 'node-fetch'
// import { join } from 'path'
import plugin from '../../../../src/btc'
import { makeFakeLog } from '../../../utils'
import { fixture } from './fixtures/bitcoinTestnet/tests'

const fakeLogger = makeFakeLog()
const log = fakeLogger

const DATA_STORE_FOLDER = 'txEngineFolderBTC'
// const FIXTURES_FOLDER = join(__dirname, 'fixtures')

// const fixtureFile = 'tests.json'
// const dummyAddressDataFile = 'dummyAddressData.json'
// const dummyHeadersDataFile = 'dummyHeadersData.json'
// const dummyTransactionsDataFile = 'dummyTransactionsData.json'

// return only the directories inside fixtures dir
// const dirs = dir =>
// readdirSync(dir).filter(file => statSync(join(dir, file)).isDirectory())

// for (const dir of dirs(FIXTURES_FOLDER)) {
//   const fixtureDataPath = join(FIXTURES_FOLDER, dir)

//   // const fixture = readFileSync(join(fixtureDataPath, fixtureFile))
//   const dummyAddressData = readFileSync(
//     join(fixtureDataPath, dummyAddressDataFile)
//   )
//   const dummyHeadersData = readFileSync(
//     join(fixtureDataPath, dummyHeadersDataFile)
//   )
//   const dummyTransactionsData = readFileSync(
//     join(fixtureDataPath, dummyTransactionsDataFile)
//   )

const WALLET_FORMAT = fixture.WALLET_FORMAT
const WALLET_TYPE = fixture.WALLET_TYPE
// const TX_AMOUNT = fixture.TX_AMOUNT

let engine: EdgeCurrencyEngine
let keys: JsonObject

const fakeIo = makeFakeIo()
const pluginOpts: EdgeCorePluginOptions = {
  initOptions: {},
  io: {
    ...fakeIo
  },
  log: fakeLogger,
  nativeIo: {},
  pluginDisklet: fakeIo.disklet
}

const factory = plugin[fixture.pluginId]
if (typeof factory !== 'function') throw new TypeError('Bad Plugin')
const corePlugin: EdgeCorePlugin = factory(pluginOpts)
const testPlugin: EdgeCurrencyPlugin = corePlugin as any

const emitter = new EventEmitter()
const callbacks = {
  onAddressesChecked(progressRatio: number) {
    emitter.emit('onAddressesCheck', progressRatio)
  },
  onBalanceChanged(currencyCode: string, balance: string) {
    emitter.emit('onBalanceChange', currencyCode, balance)
  },
  onBlockHeightChanged(height: number) {
    emitter.emit('onBlockHeightChange', height)
  },
  onTransactionsChanged(transactionList: any) {
    emitter.emit('onTransactionsChanged', transactionList)
  },
  onTxidsChanged() {
    emitter.emit('onTxidsChanged')
  },
  onAddressChanged() {
    emitter.emit('onAddressChanged')
  }
}

const walletLocalDisklet = navigateDisklet(fakeIo.disklet, DATA_STORE_FOLDER)
const engineOpts: EdgeCurrencyEngineOptions = {
  callbacks,
  log,
  walletLocalDisklet,
  walletLocalEncryptedDisklet: walletLocalDisklet,
  userSettings: fixture.ChangeSettings
}

describe(`Engine Creation Errors for Wallet type ${WALLET_TYPE}`, function () {
  before('Plugin', async function () {
    assert.equal(
      testPlugin.currencyInfo.currencyCode,
      fixture['Test Currency code']
    )
    const tools: EdgeCurrencyTools = await testPlugin.makeCurrencyTools()
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
    return await testPlugin
      .makeCurrencyEngine({ type: WALLET_TYPE, keys, id: '!' }, engineOpts)
      .catch(e => {
        assert.equal(
          e.message,
          'Cannot create an engine without a local folder'
        )
      })
  })

  it('Error when Making Engine without key', async function () {
    return await testPlugin
      .makeCurrencyEngine(
        { type: WALLET_TYPE, keys: { ninjaXpub: keys.pub }, id: '!' },
        engineOpts
      )
      .catch(e => {
        assert.equal(e.message, 'Missing Master Key')
      })
  })
})
describe(`Start Engine for Wallet type ${WALLET_TYPE}`, function () {
  // before('Create local cache file', async function (done) {
  // await walletLocalFolder
  //   .file('addresses.json')
  //   .setText(JSON.stringify(dummyAddressData))
  //   .then(
  //     async () =>
  //       await walletLocalFolder
  //         .file('txs.json')
  //         .setText(JSON.stringify(dummyTransactionsData))
  //   )
  //   .then(
  //     async () =>
  //       await walletLocalFolder
  //         .file('headers.json')
  //         .setText(JSON.stringify(dummyHeadersData))
  //   )
  //   .then(done)
  // })

  it('Make Engine', async function () {
    this.timeout(11000)
    const { id, userSettings } = fixture['Make Engine']
    await testPlugin
      .makeCurrencyEngine(
        { type: WALLET_TYPE, keys, id },
        { ...engineOpts, userSettings }
      )
      .then(e => {
        engine = e
      })
    let ratio = 0
    emitter.on('onAddressesCheck', progressRatio => {
      ratio = progressRatio
    })
    await engine.startEngine()
    await new Promise(resolve => setTimeout(resolve, 10000))
    assert.equal(ratio, 1)
  })
})

describe(`Is Address Used for Wallet type ${WALLET_TYPE} from cache`, function () {
  const testCases = fixture['Address used from cache']
  const wrongFormat = testCases.wrongFormat ?? []
  const notInWallet = testCases.notInWallet ?? []
  const empty = testCases.empty ?? {}
  // const nonEmpty = testCases.nonEmpty ?? {}

  wrongFormat.forEach((address: string) => {
    it('Checking a wrong formatted address', async function () {
      try {
        await engine.isAddressUsed(address)
      } catch (e) {
        assert(e, 'Should throw')
        expect(e.message).eqls(`Could not determine address type of ${address}`)
      }
    })
  })

  notInWallet.forEach((address: string) => {
    it("Checking an address we don't own", async function () {
      try {
        assert.equal(await engine.isAddressUsed(address), false)
      } catch (e) {
        assert(e, 'Should throw')
        assert.equal(e.message, 'Address not found in wallet')
      }
    })
  })

  Object.entries(empty).forEach(entry => {
    const [test, empty] = entry
    it(`Checking an empty ${test}`, async function () {
      assert.equal(await engine.isAddressUsed(empty), false)
    })
  })

  // Object.entries(nonEmpty).forEach(entry => {
  //   const [test, empty] = entry
  //   it(`Checking a non empty ${test}`, async function () {
  //     assert.equal(await engine.isAddressUsed(empty), true)
  //   })
  // })
})

// describe(`Get Transactions from Wallet type ${WALLET_TYPE}`, function () {
//   it('Should get number of transactions from cache', function (done) {
//     assert.equal(
//       engine.getNumTransactions({}),
//       TX_AMOUNT,
//       `should have ${TX_AMOUNT} tx from cache`
//     )
//     done()
//   })

//   it('Should get transactions from cache', async function (done) {
//     await engine.getTransactions({}).then(txs => {
//       assert.equal(
//         txs.length,
//         TX_AMOUNT,
//         `should have ${TX_AMOUNT} tx from cache`
//       )
//       done()
//     })
//   })

//   it('Should get transactions from cache with options', async function (done) {
//     await engine
//       .getTransactions({ startIndex: 1, startEntries: 2 })
//       .then(txs => {
//         assert.equal(txs.length, 2, 'should have 2 tx from cache')
//         done()
//       })
//   })
// })

describe('Should Add Gap Limit Addresses', function () {
  const gapAddresses = fixture['Add Gap Limit']
  const derived = gapAddresses.derived ?? []
  const future = gapAddresses.future ?? []

  it('Add Empty Array', async function () {
    await engine.addGapLimitAddresses([])
  })

  it('Add Already Derived Addresses', async function () {
    await engine.addGapLimitAddresses(derived)
  })

  it('Add Future Addresses', async function () {
    await engine.addGapLimitAddresses(future)
  })
})

// describe('Should start engine', function () {
//   it.skip('Get BlockHeight', function (done) {
//     const { uri, defaultHeight } = fixture.BlockHeight
//     this.timeout(3000)
//     const testHeight = (): void => {
//       emitter.on('onBlockHeightChange', height => {
//         if (height >= heightExpected) {
//           emitter.removeAllListeners('onBlockHeightChange')
//           assert(engine.getBlockHeight() >= heightExpected, 'Block height')
//           done() // Can be "done" since the promise resolves before the event fires but just be on the safe side
//         }
//       })
//       engine.startEngine().catch(e => {
//       })
//     }
//     let heightExpected = defaultHeight
//     if (uri != null) {
//       request.get(uri, (err, res, body) => {
//         if (err != null) {
//           assert(err, 'getting block height from a second source')
//         }
//         const thirdPartyHeight = parseInt(JSON.parse(body).height)
//         if (thirdPartyHeight != null && !isNaN(thirdPartyHeight)) {
//           heightExpected = thirdPartyHeight
//         }
//         testHeight()
//       })
//     } else {
//       testHeight()
//     }
//   })
// })

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

describe(`Get Fresh Address for Wallet type ${WALLET_TYPE}`, function () {
  it('Should provide a non used BTC address when no options are provided', async function () {
    this.timeout(3000)
    const address = await engine.getFreshAddress({}) // TODO
    assert.notEqual(address, null)
    // $FlowFixMe
    // const engineState: any = engine.engineState
    // const scriptHash = engineState.scriptHashes[address.publicAddress]
    // const transactions = engineState.addressInfos[scriptHash].txids
    // assert(transactions.length === 0, 'Should have never received coins')
  })
})

// describe(`Make Spend and Sign for Wallet type ${WALLET_TYPE}`, function () {
// const spendTests = fixture.Spend ?? {}
// const insufficientTests = fixture.InsufficientFundsError ?? {}
//
// it('Should fail since no spend target is given', async function () {
// const spendInfo: EdgeSpendInfo = {
// networkFeeOption: 'high',
// metadata: {
// name: 'Transfer to College Fund',
// category: 'Transfer:Wallet:College Fund'
// },
// spendTargets: []
// }
// return await engine.makeSpend(spendInfo).catch(e => {
// assert(e, 'Should throw')
// })
// })
//
// Object.entries(spendTests).forEach(entry => {
// const [test, templateSpend] = entry
// it(`Should build transaction with ${test}`, async function () {
// this.timeout(3000)
// return await engine
// .makeSpend(templateSpend as EdgeSpendInfo)
// .then(async a => {
// return await engine.signTx(a)
// })
// .then(a => {
// })
// })
// })
//
// Object.entries(insufficientTests).forEach(entry => {
// const [test, templateSpend] = entry
// it(`Should throw InsufficientFundsError for ${test}`, async function () {
// return await engine
// .makeSpend(templateSpend as EdgeSpendInfo)
// .catch(e => assert.equal(e.name, errorNames.InsufficientFundsError))
// })
// })
// })

// describe(`Sweep Keys and Sign for Wallet type ${WALLET_TYPE}`, function () {
// const sweepTests = fixture.Sweep ?? {}
//
// Object.entries(sweepTests).forEach(entry => {
// const [test, templateSpend] = entry
// it.skip(`Should build transaction with ${test}`, async function () {
// this.timeout(5000)
// if (engine.sweepPrivateKeys == null) {
// throw new Error('No sweepPrivateKeys')
// }
// const a = await engine.sweepPrivateKeys(templateSpend as EdgeSpendInfo)
// const tx = await engine.signTx(a)
// console.log(tx)
// })
// })
// })

describe(`Stop Engine for Wallet type ${WALLET_TYPE}`, function () {
  it('dump the wallet data', async function () {
    const dataDump = await engine.dumpData()
    const { id } = fixture['Make Engine']
    assert(dataDump.walletId === id, 'walletId')
    assert(dataDump.walletType === WALLET_TYPE, 'walletType')
    assert(
      dataDump.data.walletInfo.walletFormat === WALLET_FORMAT,
      'walletFormat'
    )
  })

  it('changeSettings', async function () {
    await engine.changeUserSettings(fixture.ChangeSettings)
  })

  it('Stop the engine', async function () {
    await engine.killEngine()
  })
})
