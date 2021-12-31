import { assert } from 'chai'
import {
  EdgeCorePlugin,
  EdgeCorePluginOptions,
  EdgeCurrencyPlugin,
  EdgeCurrencyTools,
  JsonObject,
  makeFakeIo
} from 'edge-core-js'
import { before, describe, it } from 'mocha'

import edgeCorePlugins from '../../../src/index'
import { testLog } from '../../util/testLog'
import { fixtures } from './currencyPlugin.fixtures/index'

for (const fixture of fixtures) {
  const WALLET_TYPE = fixture.WALLET_TYPE
  const WALLET_FORMAT = fixture.WALLET_FORMAT
  const keyName = WALLET_TYPE.split('wallet:')[1].split('-')[0] + 'Key'

  let keys: JsonObject
  let tools: EdgeCurrencyTools

  const fakeIo = makeFakeIo()
  const pluginOpts: EdgeCorePluginOptions = {
    initOptions: {},
    io: {
      ...fakeIo,
      random: () => Uint8Array.from(fixture.key)
    },
    log: testLog,
    nativeIo: {},
    pluginDisklet: fakeIo.disklet
  }
  const factory = edgeCorePlugins[fixture.pluginId]
  if (typeof factory !== 'function') {
    // Skip this test if the plugin is not available
    break
    // throw new TypeError('Bad plugin')
  }
  const corePlugin: EdgeCorePlugin = factory(pluginOpts)
  const plugin = corePlugin as EdgeCurrencyPlugin

  describe(`Info for Wallet type ${WALLET_TYPE}`, function () {
    before('Plugin', async function () {
      assert.equal(
        plugin.currencyInfo.currencyCode,
        fixture['Test Currency code']
      )
      tools = await plugin.makeCurrencyTools()
    })

    it('Test Currency code', function () {
      assert.equal(
        plugin.currencyInfo.currencyCode,
        fixture['Test Currency code']
      )
    })
  })

  describe(`createPrivateKey for Wallet type ${WALLET_TYPE}`, function () {
    it('Test Currency code', function () {
      assert.equal(
        plugin.currencyInfo.currencyCode,
        fixture['Test Currency code']
      )
    })

    it('Create valid key', async function () {
      keys = await tools.createPrivateKey(WALLET_TYPE)
      assert.isOk(keys)
      assert.equal(typeof keys[keyName], 'string')
      const length = keys[keyName].split(' ').length
      assert.equal(length, 24)
    })
  })

  describe(`derivePublicKey for Wallet type ${WALLET_TYPE}`, function () {
    this.timeout(10000)
    it('Valid private key', async function () {
      await tools
        .derivePublicKey({
          type: WALLET_TYPE,
          keys: {
            [keyName]: keys[keyName],
            format: WALLET_FORMAT
          },
          id: '!'
        })
        .then(keys => {
          assert.deepEqual(keys.publicKeys[WALLET_FORMAT], fixture.xpub)
        })
    })

    it('Invalid key name', async function () {
      await tools.derivePublicKey(fixture['invalid key name']).catch(e => {
        assert.equal(e.message, 'Either a public or private key are required')
      })
    })

    it('Invalid wallet type', async function () {
      await tools.derivePublicKey(fixture['invalid wallet type']).catch(e => {
        assert.equal(e.message, 'Either a public or private key are required')
      })
    })
  })

  describe(`parseUri for Wallet type ${WALLET_TYPE}`, function () {
    Object.entries(fixture.parseUri).forEach(([test, [input, output]]) => {
      if (output != null) {
        it(test, async function () {
          const parsedUri = await tools.parseUri(input)
          assert.deepEqual(parsedUri, output)
        })
      } else {
        it(test, async function () {
          await assert.isRejected(tools.parseUri(input))
        })
      }
    })
  })

  describe(`encodeUri for Wallet type ${WALLET_TYPE}`, function () {
    Object.entries(fixture.encodeUri).forEach(([test, [input, output]]) => {
      if (output != null) {
        it(test, async function () {
          const encodedUri = await tools.encodeUri(input)
          assert.equal(encodedUri, output)
        })
      } else {
        it(test, async function () {
          await assert.isRejected(tools.encodeUri(input))
        })
      }
    })
  })

  describe(`getSplittableTypes for Wallet type ${WALLET_TYPE}`, function () {
    const getSplittableTypes = fixture.getSplittableTypes

    if (getSplittableTypes == null) return

    Object.keys(getSplittableTypes).forEach(format => {
      it(`Test for the wallet type ${format}`, function () {
        if (tools.getSplittableTypes == null) {
          throw new Error('No getSplittableTypes')
        }
        const walletTypes = tools.getSplittableTypes({
          type: WALLET_TYPE,
          keys: { format },
          id: '!'
        })
        assert.deepEqual(walletTypes, getSplittableTypes[format])
      })
    })
  })
}
