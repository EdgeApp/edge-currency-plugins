import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { makeMemoryDisklet } from 'disklet'

import { makeProcessor, Processor } from '../../../../src/common/utxobased/db/Processor'
import { Path } from '../../../../src/common/Path'
import { BIP43PurposeTypeEnum, NetworkEnum } from '../../../../src/common/utxobased/keymanager/keymanager'
import { IAddress, IAddressPartial } from '../../../../src/common/utxobased/db/types'
import { makeAccount } from '../../../../src/common/Account'

chai.should()
chai.use(chaiAsPromised)

describe('Processor', function() {
  const storage = {}
  const disklet = makeMemoryDisklet(storage)
  let processor: Processor

  const xpub = 'ypub6Ww3ibxVfGzLrAH1PNcjyAWenMTbbAosGNB6VvmSEgytSER9azLDWCxoJwW7Ke7icmizBMXrzBx9979FfaHxHcrArf3zbeJJJUZPf663zsP'
  const account = makeAccount(xpub, {
    purpose: BIP43PurposeTypeEnum.WrappedSegwit,
    coinName: 'bitcoin',
    networkType: NetworkEnum.Mainnet
  })
  const path = account.path

  before(async () => {
    processor = await makeProcessor(disklet)
  })

  function pathToAddress(path: Path): IAddressPartial {
    return {
      scriptPubKey: account.getScriptPubKey(path),
      networkQueryVal: 0,
      path: path.toString(true)
    }
  }

  describe('saveAddress', function() {
    it('should save account address for change = 0 and index = 0', async function() {
      path.goTo(0, 0)
      await processor.saveAddress(path, pathToAddress(path))
    })
    it('should save account address for change = 0 and index = 1', async function() {
      path.goTo(1, 0)
      await processor.saveAddress(path, pathToAddress(path))
    })
    it('should save account address for change = 0 and index = 2', async function() {
      path.goTo(2, 0)
      await processor.saveAddress(path, pathToAddress(path))
    })
    it('should save account address for change = 1 and index = 0', async function() {
      path.goTo(0, 1)
      await processor.saveAddress(path, pathToAddress(path))
    })
    it('should save account address for change = 1 and index = 1', async function() {
      path.goTo(1, 1)
      await processor.saveAddress(path, pathToAddress(path))
    })
    it('should throw if address for path already exists', async function() {
      path.goTo(0, 0)

      processor.saveAddress(path, pathToAddress(path))
        .should.eventually.have.rejectedWith('Address data already exists')
    })
  })

  describe('fetchAddress', function() {
    it('should be able to fetch address data from a path', async function() {
      path.goTo(0, 0)
      const address = await processor.fetchAddress(path)
      address?.should.exist
      address!.scriptPubKey.should.equal(account.getScriptPubKey(path))
      address!.path.should.equal(path.toString(true))
    })
    it('should return null for an address that does not exists', async function() {
      path.goTo(100, 0)
      const address = await processor.fetchAddress(path)
      address?.should.not.exist
    })
    it('should update the lastQuery field', async function() {
      path.goTo(0, 0)

      const now = Date.now()
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const address = await processor.fetchAddress(path)
      address!.lastQuery.should.be.greaterThan(now)
    })
  })

  describe('updateAddress', function() {
    it('should reject if the address does not exists', function() {
      path.goTo(100, 0)
      processor.updateAddress(path, {})
        .should.eventually.have.rejectedWith('Cannot update address  that does not exist')
    })
    it('should update networkQueryVal', async function() {
      path.goTo(0, 0)
      const { networkQueryVal: oldNetworkQueryVal } = await processor.fetchAddress(path) as IAddress

      const networkQueryVal = 1234
      const { networkQueryVal: newNetworkQueryVal } = await processor.updateAddress(path, { networkQueryVal })

      newNetworkQueryVal.should.be.greaterThan(oldNetworkQueryVal)
    })
    it('should update lastQuery', async function() {
      path.goTo(0, 0)
      const { lastQuery: oldLastQuery } = await processor.fetchAddress(path) as IAddress

      const lastQuery = Date.now() + 1
      const { lastQuery: newLastQuery } = await processor.updateAddress(path, { lastQuery })

      newLastQuery.should.not.equal(oldLastQuery)
      newLastQuery.should.equal(lastQuery)
    })
    it('should update lastTouched', async function() {
      path.goTo(0, 0)
      const { lastTouched: oldLastTouched } = await processor.fetchAddress(path) as IAddress

      const lastTouched = Date.now() + 1
      const { lastTouched: newLastTouched } = await processor.updateAddress(path, { lastTouched })

      newLastTouched.should.not.equal(oldLastTouched)
      newLastTouched.should.equal(lastTouched)
    })
    it('should update used', async function() {
      path.goTo(0, 0)
      const { used: oldUsed } = await processor.fetchAddress(path) as IAddress
      oldUsed.should.be.false

      const { used: newUsed } = await processor.updateAddress(path, { used: true })
      newUsed.should.be.true

      const { used: newUsedFail } = await processor.updateAddress(path, { used: false })
      newUsedFail.should.be.true
    })
    it('should update balance and order by balance', async function() {
      path.goTo(1, 0)
      const scriptPubKey = account.getScriptPubKey(path)

      const balance = '123456789'
      const { balance: newBalance } = await processor.updateAddress(path, { balance })
      newBalance.should.equal(balance)

      console.log(storage)
      const test = await processor.fetchScriptPubKeysByBalance()
      const scriptPubKeys = await processor.fetchScriptPubKeysByBalance()
      const { idKey: scriptPubKeyByBalance } = scriptPubKeys[scriptPubKeys.length - 1]
      scriptPubKeyByBalance.should.equal(scriptPubKey)

      // undo
      await processor.updateAddress(path, { balance: '0' })
    })
  })

  describe('fetchAddressPathBySPubkey', function() {
    it('should fetch the normalized path string from a script pub key', async function() {
      path.goTo(0, 0)
      const scriptPubKey = account.getScriptPubKey(path)

      const pathStr = await processor.fetchAddressPathBySPubKey(scriptPubKey)
      pathStr!.should.equal(path.toString(true))
    })
  })

  describe('hasSPubKey', function() {
    it('should return true for a script pub key that has been saved', async function() {
      path.goTo(0, 0)
      const scriptPubKey = account.getScriptPubKey(path)
      const hasSPubKey = await processor.hasSPubKey(scriptPubKey)
      hasSPubKey.should.be.true
    })
    it('should return false for a script pub key that has not been saved', async function() {
      path.goTo(1000, 0)
      const scriptPubKey = account.getScriptPubKey(path)
      const hasSPubKey = await processor.hasSPubKey(scriptPubKey)
      hasSPubKey.should.be.false
    })
  })

  describe('fetchAddressesByPath', function() {
    it('should fetch a set of addresses for a path', async function() {
      path.goToChange(0)
      const addresses1 = await processor.fetchAddressesByPath(path)
      addresses1.length.should.equal(3)

      path.goToChange(1)
      const addresses2 = await processor.fetchAddressesByPath(path)
      addresses2.length.should.equal(2)
    })
  })

  describe.skip('fetchAddressCountFromPathPartition', function() {

  })

  describe('fetchScriptPubKeysByBalance', function() {

  })

  describe('updateAddressByScriptPubKey', function() {

  })

  describe('fetchTransaction', function() {

  })

  describe('fetchTransactionsByScriptPubKey', function() {

  })

  describe('saveTransaction', function() {

  })

  describe('updateTransaction', function() {

  })

  describe('dropTransaction', function() {

  })

  describe('fetchBalance', function() {

  })

  describe('fetchUtxos', function() {

  })

  describe('addUtxo', function() {

  })

  describe('removeUtxo', function() {

  })
})