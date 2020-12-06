import { expect, should } from 'chai'

import fixtures from '../../../../fixtures/addresses.json'
import {
  AddressFormatEnum,
  addressToFormat,
  addressToScriptPubkey,
  NetworkEnum,
  scriptPubkeyToType
} from '../../../../src/common/utxobased/keymanager/keymanager'
import { addressToAddressType } from '../../../../src/common/utxobased/keymanager/keymanager'

should()

describe('addresses', function() {
  fixtures.map((fixture) => {
    // if (fixture.network !== 'bitcoinsv') return
    describe(`${fixture.network} validity`, function() {
      for (const validAddress of fixture.valid) {
        it(`should be able to check if an address encoding is correct`, function() {
          const scriptPubKey = addressToScriptPubkey({
              address: validAddress,
              network: NetworkEnum.Mainnet,
              coin: fixture.network
          })

          const fn = () => scriptPubkeyToType(scriptPubKey)
          expect(fn).to.not.throw
        })
      }
    })

    describe(`${fixture.network} invalid`, function() {
      for (const inValidAddress of fixture.inValid) {
        it(`should be able to check if an address encoding is correct`, function() {
          const args = {
            address: inValidAddress,
            network: NetworkEnum.Mainnet,
            coin: fixture.network
          }
          const fn = () => addressToScriptPubkey(args)
          const { format } = addressToAddressType(args)
          if (format === AddressFormatEnum.Legacy) {
            expect(fn).to.not.throw
          } {
            expect(fn).to.throw
          }
        })
      }
    })

    describe(`${fixture.network} from new to legacy address format`, function() {
      for (const [ address, expected ] of fixture.toLegacy) {
        it(`should be able to encode legacy address formats for ${fixture.network}`, function() {
          const legacyAddress = addressToFormat({
            address,
            format: AddressFormatEnum.Legacy,
            network: NetworkEnum.Mainnet,
            coin: fixture.network
          })

          console.log(address, expected, legacyAddress)
          legacyAddress.should.equal(expected)
        })
      }
    })

    describe(`${fixture.network} from legacy to new address format`, function() {
      for (const [ address, expected ] of fixture.toNewFormat) {
        it(`should be able to encode new address formats for ${fixture.network}`, function() {
          const newAddress = addressToFormat({
            address,
            format: AddressFormatEnum.New,
            network: NetworkEnum.Mainnet,
            coin: fixture.network
          })

          console.log(address, expected, newAddress)
          newAddress.should.equal(expected)
        })
      }
    })
  })
})
