/* eslint-disable @typescript-eslint/no-unused-expressions */
import * as chai from 'chai'
import { expect } from 'chai'
import { makeMemoryDisklet } from 'disklet'

import {
  makeNewProcessor,
  NewProcessor
} from '../../../../src/common/utxobased/db/newProcessor'
import { IAddress } from '../../../../src/common/utxobased/db/types'

chai.should()

interface Fixtures {
  assertNumAddressesWithPaths: (expectedNum: number) => void
  assertLastUsedByFormatPath: (toBe: number | undefined) => Promise<void>
  processor: NewProcessor
}

const makeFixtures = async (): Promise<Fixtures> => {
  const storage = {}
  const disklet = makeMemoryDisklet(storage)
  const processor = await makeNewProcessor({ disklet })

  return {
    assertNumAddressesWithPaths: expectedNum => {
      const num = processor.numAddressesByFormatPath({
        format: 'bip44',
        changeIndex: 0
      })
      expect(num).eql(expectedNum)
    },

    assertLastUsedByFormatPath: async toBe => {
      const result = await processor.lastUsedIndexByFormatPath({
        format: 'bip44',
        changeIndex: 0
      })
      expect(result).eql(toBe)
    },
    processor
  }
}

describe('Processor address tests', () => {
  it('empty address baselets', async () => {
    const {
      assertNumAddressesWithPaths,
      assertLastUsedByFormatPath
    } = await makeFixtures()

    assertNumAddressesWithPaths(0)
    await assertLastUsedByFormatPath(undefined)
  })

  it('insert address to baselets', async () => {
    const {
      assertNumAddressesWithPaths,
      assertLastUsedByFormatPath,
      processor
    } = await makeFixtures()

    // Insert an unused address without a path
    const address1: IAddress = {
      scriptPubkey: 'testscriptpubkey1',
      networkQueryVal: 0,
      lastQuery: 0,
      lastTouched: 0,
      used: false,
      balance: ''
    }
    await processor.saveAddress(address1)
    // Assertions
    assertNumAddressesWithPaths(0)
    await assertLastUsedByFormatPath(undefined)
    const processorAddress1 = await processor.fetchAddresses(
      'testscriptpubkey1'
    )
    expect(processorAddress1.scriptPubkey).to.eqls(address1.scriptPubkey)

    // Insert an unused address with a path
    const address2: IAddress = {
      scriptPubkey: 'testscriptpubkey2',
      networkQueryVal: 0,
      lastQuery: 0,
      path: { format: 'bip44', changeIndex: 0, addressIndex: 0 },
      lastTouched: 0,
      used: false,
      balance: ''
    }
    await processor.saveAddress(address2)
    // Assertions
    assertNumAddressesWithPaths(1)
    await assertLastUsedByFormatPath(undefined)
    const processorAddress2 = await processor.fetchAddresses(
      'testscriptpubkey2'
    )
    expect(processorAddress2.scriptPubkey).to.eqls(address2.scriptPubkey)

    // Insert a used address with a conflicting path
    const address3: IAddress = {
      scriptPubkey: 'testscriptpubkey3',
      networkQueryVal: 0,
      lastQuery: 0,
      path: { format: 'bip44', changeIndex: 0, addressIndex: 0 },
      lastTouched: 0,
      used: true,
      balance: ''
    }
    await processor
      .saveAddress(address3)
      .should.be.rejectedWith(
        'Attempted to save address with an existing path, but different script pubkey'
      )
    // Assertions
    assertNumAddressesWithPaths(1)
    const processorAddress3 = await processor.fetchAddresses(
      'testscriptpubkey3'
    )
    expect(processorAddress3).to.be.undefined

    // Insert a used address with a path
    const address4: IAddress = {
      scriptPubkey: 'testscriptpubkey3',
      networkQueryVal: 0,
      lastQuery: 0,
      path: { format: 'bip44', changeIndex: 0, addressIndex: 1 },
      lastTouched: 0,
      used: true,
      balance: ''
    }
    await processor.saveAddress(address4)
    // Assertions
    assertNumAddressesWithPaths(2)
    const processorAddress4 = await processor.fetchAddresses(
      'testscriptpubkey3'
    )
    expect(processorAddress4.scriptPubkey).to.eqls(address4.scriptPubkey)
    await assertLastUsedByFormatPath(1)
  })

  it('update address in baselets', async () => {
    const {
      assertNumAddressesWithPaths,
      assertLastUsedByFormatPath,
      processor
    } = await makeFixtures()

    // Insert an unused address without a path
    let address: IAddress = {
      scriptPubkey: 'testscriptpubkey1',
      networkQueryVal: 0,
      lastQuery: 0,
      lastTouched: 0,
      used: false,
      balance: ''
    }
    await processor.saveAddress(address)
    // Assertions
    assertNumAddressesWithPaths(0)
    await assertLastUsedByFormatPath(undefined)
    const processorAddress1 = await processor.fetchAddresses(
      'testscriptpubkey1'
    )
    expect(processorAddress1.scriptPubkey).to.eqls(address.scriptPubkey)

    // Update the address with a path
    address = {
      ...address,
      path: {
        format: 'bip44',
        changeIndex: 0,
        addressIndex: 0
      }
    }
    await processor.saveAddress(address)
    // Assertions
    assertNumAddressesWithPaths(1)
    await assertLastUsedByFormatPath(undefined)
    const processorAddress2 = await processor.fetchAddresses(
      'testscriptpubkey1'
    )
    expect(processorAddress2.scriptPubkey).to.eqls('testscriptpubkey1')

    // Update the used flag of an existing address with a path
    address = { ...address, used: true }
    await processor.saveAddress(address)
    // Assertions
    assertNumAddressesWithPaths(1)
    const processorAddress3 = await processor.fetchAddresses(
      'testscriptpubkey1'
    )
    expect(processorAddress3.scriptPubkey).to.eqls('testscriptpubkey1')
    await assertLastUsedByFormatPath(0)

    // Update various address fields of an existing address with a path
    address = {
      ...address,
      networkQueryVal: 1,
      lastQuery: 1,
      lastTouched: 1,
      balance: '0'
    }
    await processor.saveAddress(address)
    // Assertions
    assertNumAddressesWithPaths(1)
    const processorAddress4 = await processor.fetchAddresses(
      'testscriptpubkey1'
    )
    expect(processorAddress4.scriptPubkey).to.eqls('testscriptpubkey1')
    expect(processorAddress4.networkQueryVal).to.eqls(1)
    expect(processorAddress4.lastQuery).to.eqls(1)
    expect(processorAddress4.lastTouched).to.eqls(1)
    expect(processorAddress4.balance).to.eqls('0')
  })
})