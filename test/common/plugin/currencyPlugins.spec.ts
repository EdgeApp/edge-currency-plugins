import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { makeFakeIo } from 'edge-core-js'

import fixtures from '../../../fixtures/currencyPlugins.json'
import { makeCurrencyTools } from '../../../src/common/plugin/makeCurrencyTools'
import * as allInfo from '../../../src/common/utxobased/info/all'

chai.should()
chai.use(chaiAsPromised)

describe('currencyPlugins', function () {
  for (const fixture of fixtures) {
    describe(fixture.pluginId, function () {
      const fakeIo = makeFakeIo()
      // @ts-expect-error
      const tools = makeCurrencyTools(
        fakeIo,
        allInfo[fixture.pluginId] ?? allInfo.bitcoin
      )

      describe('parseUri', function () {
        Object.keys(fixture.parseUri).forEach(test => {
          // @ts-expect-error
          const [data, expectedParseUri] = fixture.parseUri[test] as any

          const promise = tools.parseUri(data)

          it(test, async function () {
            if (test.includes('invalid')) {
              return await promise.should.be.rejected
            } else {
              const encodedUri = await promise
              encodedUri.should.eql(expectedParseUri)
            }
          })
        })
      })

      describe('encodeUri', function () {
        Object.keys(fixture.encodeUri).forEach(test => {
          // @ts-expect-error
          const [data, expectedEncodeUri] = fixture.encodeUri[test] as any

          const promise = tools.encodeUri(data)

          it(test, async function () {
            if (test.includes('invalid')) {
              return await promise.should.be.rejected
            } else {
              const encodedUri = await promise
              encodedUri.should.equal(expectedEncodeUri)
            }
          })
        })
      })
    })
  }
})
