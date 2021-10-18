import * as chai from 'chai'
import { assert } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { makeMemoryDisklet } from 'disklet'
import {
  EdgeCorePlugin,
  EdgeCorePluginOptions,
  EdgeCurrencyPlugin,
  EdgeCurrencyTools,
  EdgeEncodeUri,
  JsonObject
} from 'edge-core-js/types'

import fixtures from '../../../fixtures/currencyPlugins.json'
import plugins from '../../../src/index'
import { makeFakeIo, makeFakeLog } from '../../utils'

chai.should()
chai.use(chaiAsPromised)

for (const fixture of fixtures) {
  const WALLET_TYPE = fixture.WALLET_TYPE
  const WALLET_FORMAT = fixture.WALLET_FORMAT
  const keyName = WALLET_TYPE.split('wallet:')[1].split('-')[0] + 'Key'
  const xpubName = WALLET_TYPE.split('wallet:')[1].split('-')[0] + 'Xpub'

  let keys: JsonObject
  let tools: EdgeCurrencyTools

  const fakeIo = makeFakeIo()
  const pluginOpts: EdgeCorePluginOptions = {
    initOptions: {},
    io: fakeIo,
    log: makeFakeLog(),
    nativeIo: {},
    pluginDisklet: makeMemoryDisklet()
  }

  const factory = plugins[fixture.pluginId]
  if (typeof factory !== 'function') throw new TypeError('Bad Plugin')
  const corePlugin: EdgeCorePlugin = factory(pluginOpts)
  const testPlugin: EdgeCurrencyPlugin = corePlugin as any

  describe(`Info for Wallet type ${WALLET_TYPE}`, function () {
    this.timeout(3000)

    before('Plugin', async () => {
      assert.equal(
        testPlugin.currencyInfo.currencyCode,
        fixture['Test Currency code']
      )
      tools = await testPlugin.makeCurrencyTools()
    })

    it('Test Currency code', () => {
      assert.equal(
        testPlugin.currencyInfo.currencyCode,
        fixture['Test Currency code']
      )
    })
  })

  describe(`createPrivateKey for Wallet type ${WALLET_TYPE}`, function () {
    this.timeout(3000)

    it('Test Currency code', () => {
      assert.equal(
        testPlugin.currencyInfo.currencyCode,
        fixture['Test Currency code']
      )
    })

    it('Create valid key', async () => {
      keys = await tools.createPrivateKey(WALLET_TYPE)
      assert(keys != null)
      assert.equal(typeof keys[keyName], 'string')
      const length = keys[keyName].split(' ').length
      assert.equal(length, 24)
    })
  })

  describe.skip(`derivePublicKey for Wallet type ${WALLET_TYPE}`, function () {
    it('Valid private key', async () => {
      keys = await tools.derivePublicKey({
        type: WALLET_TYPE,
        keys: {
          [keyName]: keys[keyName],
          format: WALLET_FORMAT
        },
        id: '!'
      })

      const xpub: string[] = Object.values(keys[xpubName])
      assert.equal(xpub[0], fixture.xpub)
    })

    it('Invalid key name', done => {
      tools.derivePublicKey(fixture['invalid key name']).catch(_e => {
        done()
      })
    })

    it('Invalid wallet type', function (done) {
      tools.derivePublicKey(fixture['invalid wallet type']).catch(_e => {
        done()
      })
    })
  })

  describe(`getSplittableTypes for Wallet type ${WALLET_TYPE}`, () => {
    const getSplittableTypes = fixture.getSplittableTypes ?? {}
    Object.entries(getSplittableTypes).forEach(entry => {
      const [format, types] = entry
      it(`Test for the wallet type ${format}`, function () {
        if (tools.getSplittableTypes == null) {
          throw new Error('No getSplittableTypes')
        }
        const walletTypes = tools.getSplittableTypes({
          type: WALLET_TYPE,
          keys: { format },
          id: '!'
        })
        assert.deepEqual(walletTypes, types)
      })
    })
  })

  describe(`parseUri for Wallet type ${WALLET_TYPE}`, function () {
    Object.entries(fixture.parseUri).forEach(entry => {
      const [test, content] = entry
      if (content == null) {
        assert(false)
        return
      }

      it(test, async function () {
        const promise = tools.parseUri(content[0] as string)

        if (test.includes('invalid')) {
          return await promise.should.be.rejected
        } else {
          const parsedUri = await promise
          const expectedParsedUri = content[1] as EdgeEncodeUri
          assert.deepEqual(parsedUri, expectedParsedUri)
        }
      })
    })
  })

  describe(`encodeUri for Wallet type ${WALLET_TYPE}`, function () {
    Object.entries(fixture.encodeUri).forEach(entry => {
      const [test, content] = entry
      if (content == null) {
        assert(false)
        return
      }
      it(test, async function () {
        const promise = tools.encodeUri(content[0] as EdgeEncodeUri)

        if (test.includes('invalid')) {
          return await promise.should.be.rejected
        } else {
          const encodedUri = await tools.encodeUri(content[0] as EdgeEncodeUri)
          const expectedEncodeUri = content[1] as string
          assert.equal(encodedUri, expectedEncodeUri)
        }
      })
    })
  })
}
