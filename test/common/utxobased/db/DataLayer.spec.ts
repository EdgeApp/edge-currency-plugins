/* eslint-disable @typescript-eslint/no-unused-expressions */
import * as chai from 'chai'
import { expect } from 'chai'
import { makeMemoryDisklet } from 'disklet'

import {
  DataLayer,
  makeDataLayer
} from '../../../../src/common/utxobased/db/DataLayer'
import {
  AddressData,
  TransactionData,
  TransactionDataInput,
  TransactionDataOutput,
  UtxoData
} from '../../../../src/common/utxobased/db/types'
import { ScriptTypeEnum } from '../../../../src/common/utxobased/keymanager/keymanager'
import { unixTime } from '../../../../src/util/unixTime'

chai.should()

interface Fixtures {
  assertNumAddressesWithPaths: (expectedNum: number) => void
  assertLastUsedByFormatPath: (toBe: number) => Promise<void>
  assertNumTransactions: (expectedNum: number, dataLayer: DataLayer) => void
  assertObjectNotUndefined: <T>(object: T | undefined) => T
  dataLayer: DataLayer
}

const makeFixtures = async (): Promise<Fixtures> => {
  const storage = {}
  const disklet = makeMemoryDisklet(storage)
  const dataLayer = await makeDataLayer({ disklet })

  return {
    assertNumAddressesWithPaths: expectedNum => {
      const num = dataLayer.numAddressesByFormatPath({
        format: 'bip44',
        changeIndex: 0
      })
      expect(num).eql(expectedNum)
    },

    assertLastUsedByFormatPath: async toBe => {
      const result = await dataLayer.lastUsedIndexByFormatPath({
        format: 'bip44',
        changeIndex: 0
      })
      expect(result).eql(toBe)
    },

    assertNumTransactions: (
      expectedNum: number,
      dataLayer: DataLayer
    ): void => {
      const num = dataLayer.numTransactions()
      expect(num).eql(expectedNum)
    },

    assertObjectNotUndefined: <T>(object: T | undefined): T => {
      if (object == null)
        throw new Error(`unable to retrieve from the dataLayer`)
      return object
    },

    dataLayer
  }
}

describe('DataLayer address tests', () => {
  it('empty address baselets', async () => {
    const {
      assertNumAddressesWithPaths,
      assertLastUsedByFormatPath,
      dataLayer
    } = await makeFixtures()

    assertNumAddressesWithPaths(0)
    await assertLastUsedByFormatPath(-1)

    expect(await dataLayer.fetchAddress('doesnotexist')).to.be.undefined
    expect(
      await dataLayer.fetchAddress({
        format: 'bip44',
        changeIndex: 0,
        addressIndex: 0
      })
    ).to.be.undefined
  })

  it('insert address to baselets', async () => {
    const {
      assertNumAddressesWithPaths,
      assertLastUsedByFormatPath,
      assertObjectNotUndefined,
      dataLayer
    } = await makeFixtures()

    // Insert an unused address without a path
    const address1: AddressData = {
      scriptPubkey: 'testscriptpubkey1',
      lastQueriedBlockHeight: 0,
      lastQuery: 0,
      lastTouched: 0,
      used: false,
      balance: ''
    }
    await dataLayer.saveAddress(address1)
    // Assertions
    assertNumAddressesWithPaths(0)
    await assertLastUsedByFormatPath(-1)
    const addressData1 = assertObjectNotUndefined(
      await dataLayer.fetchAddress(address1.scriptPubkey)
    )
    expect(addressData1?.scriptPubkey).to.eqls(address1.scriptPubkey)

    // Insert an unused address with a path
    const address2: AddressData = {
      scriptPubkey: 'testscriptpubkey2',
      lastQueriedBlockHeight: 0,
      lastQuery: 0,
      path: { format: 'bip44', changeIndex: 0, addressIndex: 0 },
      lastTouched: 0,
      used: false,
      balance: ''
    }
    await dataLayer.saveAddress(address2)
    // Assertions
    assertNumAddressesWithPaths(1)
    await assertLastUsedByFormatPath(-1)
    const addressData2 = assertObjectNotUndefined(
      await dataLayer.fetchAddress(address2.scriptPubkey)
    )
    expect(addressData2?.scriptPubkey).to.eqls(address2.scriptPubkey)

    // Insert a used address with a conflicting path
    const address3: AddressData = {
      scriptPubkey: 'testscriptpubkey3',
      lastQueriedBlockHeight: 0,
      lastQuery: 0,
      path: { format: 'bip44', changeIndex: 0, addressIndex: 0 },
      lastTouched: 0,
      used: true,
      balance: ''
    }
    await dataLayer
      .saveAddress(address3)
      .should.be.rejectedWith(
        'Attempted to save address with an existing path, but different script pubkey'
      )
    // Assertions
    assertNumAddressesWithPaths(1)
    const addressData3 = await dataLayer.fetchAddress(address3.scriptPubkey)
    expect(addressData3).to.be.undefined

    // Insert a used address with a path
    const address4: AddressData = {
      scriptPubkey: 'testscriptpubkey3',
      lastQueriedBlockHeight: 0,
      lastQuery: 0,
      path: { format: 'bip44', changeIndex: 0, addressIndex: 1 },
      lastTouched: 0,
      used: true,
      balance: ''
    }
    await dataLayer.saveAddress(address4)
    // Assertions
    assertNumAddressesWithPaths(2)
    const addressData4 = assertObjectNotUndefined(
      await dataLayer.fetchAddress(address4.scriptPubkey)
    )
    expect(addressData4?.scriptPubkey).to.eqls(address4.scriptPubkey)
    await assertLastUsedByFormatPath(1)

    // check behavior of not found addresses in populated baselets:
    expect(await dataLayer.fetchAddress('doesnotexist')).to.be.undefined
    expect(
      await dataLayer.fetchAddress({
        format: 'bip32',
        changeIndex: 0,
        addressIndex: 0
      })
    ).to.be.undefined
  })

  it('update address in baselets', async () => {
    const {
      assertNumAddressesWithPaths,
      assertLastUsedByFormatPath,
      assertObjectNotUndefined,
      dataLayer
    } = await makeFixtures()

    // Insert an unused address without a path
    let address: AddressData = {
      scriptPubkey: 'testscriptpubkey1',
      lastQueriedBlockHeight: 0,
      lastQuery: 0,
      lastTouched: 0,
      used: false,
      balance: ''
    }
    await dataLayer.saveAddress(address)
    // Assertions
    assertNumAddressesWithPaths(0)
    await assertLastUsedByFormatPath(-1)
    const addressData1 = assertObjectNotUndefined(
      await dataLayer.fetchAddress(address.scriptPubkey)
    )
    expect(addressData1?.scriptPubkey).to.eqls(address.scriptPubkey)

    // Update the address with a path
    address = {
      ...address,
      path: {
        format: 'bip44',
        changeIndex: 0,
        addressIndex: 0
      }
    }
    await dataLayer.saveAddress(address)
    // Assertions
    assertNumAddressesWithPaths(1)
    await assertLastUsedByFormatPath(-1)
    const addressData2 = assertObjectNotUndefined(
      await dataLayer.fetchAddress(address.scriptPubkey)
    )
    expect(addressData2.scriptPubkey).to.eqls(address.scriptPubkey)

    // Update the used flag of an existing address with a path
    address = { ...address, used: true }
    await dataLayer.saveAddress(address)
    // Assertions
    assertNumAddressesWithPaths(1)
    const addressData3 = assertObjectNotUndefined(
      await dataLayer.fetchAddress(address.scriptPubkey)
    )
    expect(addressData3.scriptPubkey).to.eqls(address.scriptPubkey)
    await assertLastUsedByFormatPath(0)

    // Update various address fields of an existing address with a path
    address = {
      ...address,
      lastQueriedBlockHeight: 1,
      lastQuery: 1,
      lastTouched: 1,
      balance: '0'
    }
    await dataLayer.saveAddress(address)
    // Assertions
    assertNumAddressesWithPaths(1)
    const addressData4 = assertObjectNotUndefined(
      await dataLayer.fetchAddress(address.scriptPubkey)
    )
    expect(addressData4.scriptPubkey).to.eqls(address.scriptPubkey)
    expect(addressData4.lastQueriedBlockHeight).to.eqls(1)
    expect(addressData4.lastQuery).to.eqls(1)
    expect(addressData4.lastTouched).to.eqls(1)
    expect(addressData4.balance).to.eqls('0')
  })
})

describe('DataLayer utxo tests', () => {
  it('insert utxo to baselets', async () => {
    const { dataLayer } = await makeFixtures()

    // Insert a utxo
    const utxo1: UtxoData = {
      id: 'utxo000001',
      txid: 'transaction1',
      vout: 0,
      value: '',
      scriptPubkey: 'scriptPubkey1',
      script: '',
      scriptType: ScriptTypeEnum.p2pk,
      blockHeight: 0,
      spent: false
    }
    await dataLayer.saveUtxo(utxo1)
    // Fetch all
    await dataLayer.fetchUtxos({ utxoIds: [] }).then(utxos => {
      expect(utxos).to.eqls([utxo1])
    })
    // Fetch one
    await dataLayer.fetchUtxos({ utxoIds: ['utxo000001'] }).then(utxos => {
      expect(utxos).to.eqls([utxo1])
    })

    // Insert a second utxo
    const utxo2: UtxoData = {
      id: 'utxo000002',
      txid: 'transaction2',
      vout: 0,
      value: '',
      scriptPubkey: 'scriptPubkey2',
      script: '',
      scriptType: ScriptTypeEnum.p2pk,
      blockHeight: 0,
      spent: false
    }
    await dataLayer.saveUtxo(utxo2)
    // Fetch all
    await dataLayer.fetchUtxos({ utxoIds: [] }).then(utxos => {
      expect(utxos).to.eqls([utxo1, utxo2])
    })
    // Fetch two
    await dataLayer
      .fetchUtxos({ utxoIds: ['utxo000001', 'utxo000002'] })
      .then(utxos => {
        expect(utxos).to.eqls([utxo1, utxo2])
      })

    // Fetch by scriptPubkey
    await dataLayer
      .fetchUtxos({ scriptPubkey: utxo1.scriptPubkey })
      .then(utxos => {
        expect(utxos).to.eqls([utxo1])
      })
    await dataLayer
      .fetchUtxos({ scriptPubkey: utxo2.scriptPubkey })
      .then(utxos => {
        expect(utxos).to.eqls([utxo2])
      })
  })

  it('update utxo in baselets', async () => {
    const { dataLayer } = await makeFixtures()

    // Insert a utxo
    const utxoOriginal: UtxoData = {
      id: 'utxo000001',
      txid: 'transaction1',
      vout: 0,
      value: 'aaa111',
      scriptPubkey: 'scriptPubkey1',
      script: '',
      scriptType: ScriptTypeEnum.p2pk,
      blockHeight: 0,
      spent: false
    }
    await dataLayer.saveUtxo(utxoOriginal)
    // Fetch all
    await dataLayer.fetchUtxos({ utxoIds: [] }).then(utxos => {
      expect(utxos).to.eqls([utxoOriginal])
    })
    // Fetch one
    await dataLayer.fetchUtxos({ utxoIds: ['utxo000001'] }).then(utxos => {
      expect(utxos).to.eqls([utxoOriginal])
    })

    // Insert a second utxo
    const utxoUpdated: UtxoData = {
      id: 'utxo000001',
      txid: 'transaction1',
      vout: 0,
      value: 'bbb222',
      scriptPubkey: 'scriptPubkey2',
      script: '',
      scriptType: ScriptTypeEnum.p2pk,
      blockHeight: 0,
      spent: false
    }
    await dataLayer.saveUtxo(utxoUpdated)
    // Fetch all
    await dataLayer.fetchUtxos({ utxoIds: [] }).then(utxos => {
      expect(utxos).to.eqls([utxoUpdated])
    })
    // Fetch one
    await dataLayer.fetchUtxos({ utxoIds: ['utxo000001'] }).then(utxos => {
      expect(utxos).to.eqls([utxoUpdated])
    })
  })

  it('remove utxo in baselets', async () => {
    const { dataLayer } = await makeFixtures()

    // Insert a utxo
    const utxo: UtxoData = {
      id: 'utxo000001',
      txid: 'transaction1',
      vout: 0,
      value: 'aaa111',
      scriptPubkey: 'scriptPubkey1',
      script: '',
      scriptType: ScriptTypeEnum.p2pk,
      blockHeight: 0,
      spent: false
    }
    await dataLayer.saveUtxo(utxo)
    // Fetch all
    await dataLayer.fetchUtxos({ utxoIds: [] }).then(utxos => {
      expect(utxos).to.eqls([utxo])
    })
    // Fetch all
    await dataLayer.fetchUtxos({ utxoIds: ['utxo000001'] }).then(utxos => {
      expect(utxos).to.eqls([utxo])
    })
    // Fetch by scriptPubkey
    await dataLayer
      .fetchUtxos({ scriptPubkey: utxo.scriptPubkey })
      .then(utxos => {
        expect(utxos).to.eqls([utxo])
      })

    // Remove utxo
    await dataLayer.removeUtxos(['utxo000001'])
    // Fetch all
    await dataLayer.fetchUtxos({ utxoIds: [] }).then(utxos => {
      expect(utxos).to.eqls([])
    })
    // Fetch one
    await dataLayer.fetchUtxos({ utxoIds: ['utxo000001'] }).then(utxos => {
      expect(utxos).to.eqls([undefined])
    })
    // Fetch by scriptPubkey
    await dataLayer
      .fetchUtxos({ scriptPubkey: utxo.scriptPubkey })
      .then(utxos => {
        expect(utxos).to.eqls([])
      })
  })

  it('query all utxos in baselets', async () => {
    const { dataLayer } = await makeFixtures()

    // Insert a utxo
    const utxos: UtxoData[] = [
      {
        id: 'utxo000001',
        txid: 'transaction1',
        vout: 0,
        value: 'aaa111',
        scriptPubkey: 'scriptPubkey1',
        script: '',
        scriptType: ScriptTypeEnum.p2pk,
        blockHeight: 0,
        spent: false
      },
      {
        id: 'utxo000002',
        txid: 'transaction1',
        vout: 0,
        value: 'bbb222',
        scriptPubkey: 'scriptPubkey2',
        script: '',
        scriptType: ScriptTypeEnum.p2pk,
        blockHeight: 0,
        spent: false
      },
      {
        id: 'utxo000003',
        txid: 'transaction1',
        vout: 0,
        value: 'ccc333',
        scriptPubkey: 'scriptPubkey3',
        script: '',
        scriptType: ScriptTypeEnum.p2pk,
        blockHeight: 0,
        spent: false
      },
      {
        id: 'utxo000004',
        txid: 'transaction1',
        vout: 0,
        value: 'ddd444',
        scriptPubkey: 'scriptPubkey4',
        script: '',
        scriptType: ScriptTypeEnum.p2pk,
        blockHeight: 0,
        spent: false
      },
      {
        id: 'utxo000005',
        txid: 'transaction1',
        vout: 0,
        value: 'eee555',
        scriptPubkey: 'scriptPubkey5',
        script: '',
        scriptType: ScriptTypeEnum.p2pk,
        blockHeight: 0,
        spent: false
      }
    ]
    for (const utxo of utxos) {
      await dataLayer.saveUtxo(utxo)
    }
    // Fetch all
    await dataLayer.fetchUtxos({ utxoIds: [] }).then(utxos => {
      expect(utxos).to.eqls(utxos)
    })

    for (const utxo of utxos) {
      // Fetch by scriptPubkey
      await dataLayer
        .fetchUtxos({ scriptPubkey: utxo.scriptPubkey })
        .then(utxos => {
          expect(utxos).to.eqls([utxo])
        })
    }
  })
})
describe('DataLayer transactions tests', () => {
  function assertNumTransactions(
    expectedNum: number,
    dataLayer: DataLayer
  ): void {
    const num = dataLayer.numTransactions()
    expect(num).eql(expectedNum)
  }

  it('empty transaction baselets', async () => {
    const storage = {}
    const disklet = makeMemoryDisklet(storage)

    const dataLayer = await makeDataLayer({ disklet })
    assertNumTransactions(0, dataLayer)
  })

  it('insert a transaction to transaction baselets', async () => {
    const storage = {}
    const disklet = makeMemoryDisklet(storage)
    const dataLayer = await makeDataLayer({ disklet })

    const input1: TransactionDataInput = {
      txId: 'random',
      outputIndex: 0,
      scriptPubkey: 'pubkeyin1',
      sequence: 0xfffffffe,
      n: 0,
      amount: '1'
    }
    const output1: TransactionDataOutput = {
      amount: '1',
      n: 0,
      scriptPubkey: 'pubkeyout1'
    }
    const output2: TransactionDataOutput = {
      amount: '1',
      n: 1,
      scriptPubkey: 'pubkeyout2'
    }
    const transaction1: TransactionData = {
      txid: 'transaction1',
      hex: '',
      blockHeight: 1,
      date: unixTime(new Date(10_000).getTime()),
      fees: '1',
      inputs: [input1],
      outputs: [output1, output2],
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    }

    await dataLayer.saveTransaction({
      tx: transaction1,
      scriptPubkeys: [output1.scriptPubkey]
    })

    assertNumTransactions(1, dataLayer)
    const [tx1] = await dataLayer.fetchTransactions({ txId: transaction1.txid })
    expect(tx1?.ourOuts[0]).to.eqls('0')
    expect(tx1?.ourAmount).to.eqls('1')
    const [txByBlockHeight1] = await dataLayer.fetchTransactions({
      blockHeight: 1
    })
    expect(txByBlockHeight1?.blockHeight).to.eqls(1)

    // insert the same transaction, but with a script pubkey referencing an input
    await dataLayer.saveTransaction({
      tx: transaction1,
      scriptPubkeys: [input1.scriptPubkey]
    })

    const [tx2] = await dataLayer.fetchTransactions({ txId: transaction1.txid })
    expect(tx2?.ourOuts[0]).to.eqls('0')
    expect(tx2?.ourIns[0]).to.eqls('0')
    expect(tx2?.ourAmount).to.eqls('0')

    // insert the same transaction, but with a script pubkey referencing another output
    await dataLayer.saveTransaction({
      tx: transaction1,
      scriptPubkeys: [output2.scriptPubkey]
    })

    const [tx3] = await dataLayer.fetchTransactions({ txId: transaction1.txid })
    expect(tx3?.ourOuts[1]).to.eqls('1')
    expect(tx3?.ourIns[0]).to.eqls('0')
    expect(tx3?.ourAmount).to.eqls('1')

    const [tx4] = await dataLayer.fetchTransactions({
      options: {
        tokenId: null
      }
    })
    expect(tx4).not.to.be.undefined

    const results = await dataLayer.fetchTransactions({
      options: {
        tokenId: null,
        startDate: new Date(11_000),
        endDate: new Date(15_000)
      }
    })
    expect(results).to.deep.equal([])

    const [tx6] = await dataLayer.fetchTransactions({
      options: {
        tokenId: null,
        startDate: new Date(9_000),
        endDate: new Date(15_000)
      }
    })
    expect(tx6).not.to.be.undefined
  })

  it('insert multiple transactions to baselets', async () => {
    const storage = {}
    const disklet = makeMemoryDisklet(storage)
    const dataLayer = await makeDataLayer({ disklet })

    const input1: TransactionDataInput = {
      txId: 'random',
      outputIndex: 0,
      scriptPubkey: 'pubkeyin1',
      sequence: 0xfffffffe,
      n: 0,
      amount: '1'
    }
    const output1: TransactionDataOutput = {
      amount: '1',
      n: 0,
      scriptPubkey: 'pubkeyout1'
    }
    const output2: TransactionDataOutput = {
      amount: '1',
      n: 1,
      scriptPubkey: 'pubkeyout2'
    }
    const transaction1: TransactionData = {
      txid: 'transaction1',
      hex: '',
      blockHeight: 1,
      date: unixTime(new Date(10_000).getTime()),
      fees: '1',
      inputs: [input1],
      outputs: [output1, output2],
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    }

    const transaction2: TransactionData = {
      txid: 'transaction2',
      hex: '',
      blockHeight: 1,
      date: unixTime(new Date(20_000).getTime()),
      fees: '1',
      inputs: [input1],
      outputs: [output1, output2],
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    }

    await dataLayer.saveTransaction({
      tx: transaction1,
      scriptPubkeys: [output1.scriptPubkey]
    })
    await dataLayer.saveTransaction({
      tx: transaction2,
      scriptPubkeys: [output2.scriptPubkey]
    })

    assertNumTransactions(2, dataLayer)
    const [tx1] = await dataLayer.fetchTransactions({ txId: transaction1.txid })
    expect(tx1?.ourOuts[0]).to.eqls('0')
    expect(tx1?.ourAmount).to.eqls('1')
    const txsByBlockHeight = await dataLayer.fetchTransactions({
      blockHeight: 1
    })
    expect(txsByBlockHeight[0]?.blockHeight).to.eqls(1)
    expect(txsByBlockHeight[1]?.blockHeight).to.eqls(1)

    await dataLayer.saveTransaction({
      tx: transaction1,
      scriptPubkeys: [input1.scriptPubkey]
    })

    const [tx2] = await dataLayer.fetchTransactions({ txId: transaction1.txid })
    expect(tx2?.ourOuts[0]).to.eqls('0')
    expect(tx2?.ourIns[0]).to.eqls('0')
    expect(tx2?.ourAmount).to.eqls('0')

    await dataLayer.saveTransaction({
      tx: transaction1,
      scriptPubkeys: [output2.scriptPubkey]
    })

    const [tx3] = await dataLayer.fetchTransactions({ txId: transaction1.txid })
    expect(tx3?.ourOuts[1]).to.eqls('1')
    expect(tx3?.ourIns[0]).to.eqls('0')
    expect(tx3?.ourAmount).to.eqls('1')

    const [tx4] = await dataLayer.fetchTransactions({
      options: {
        tokenId: null
      }
    })
    expect(tx4).not.to.be.undefined

    const [tx5] = await dataLayer.fetchTransactions({
      options: {
        tokenId: null,
        startDate: new Date(11_000),
        endDate: new Date(20_000)
      }
    })
    expect(tx5).not.to.be.undefined

    const tx6 = await dataLayer.fetchTransactions({
      options: {
        tokenId: null,
        startDate: new Date(9_000),
        endDate: new Date(21_000)
      }
    })
    expect(tx6.length).to.eqls(2)
  })

  it('update transaction blockheight in transaction baselets', async () => {
    const storage = {}
    const disklet = makeMemoryDisklet(storage)
    const dataLayer = await makeDataLayer({ disklet })

    const input1: TransactionDataInput = {
      txId: 'random',
      outputIndex: 0,
      scriptPubkey: 'pubkeyin1',
      sequence: 0xfffffffe,
      n: 0,
      amount: '1'
    }
    const output1: TransactionDataOutput = {
      amount: '1',
      n: 0,
      scriptPubkey: 'pubkeyout1'
    }
    const output2: TransactionDataOutput = {
      amount: '1',
      n: 1,
      scriptPubkey: 'pubkeyout2'
    }
    const transaction1: TransactionData = {
      txid: 'transaction1',
      hex: '',
      blockHeight: 1,
      date: unixTime(new Date(10_000).getTime()),
      fees: '1',
      inputs: [input1],
      outputs: [output1, output2],
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    }

    const transaction2: TransactionData = {
      txid: 'transaction2',
      hex: '',
      blockHeight: 1,
      date: unixTime(new Date(20_000).getTime()),
      fees: '1',
      inputs: [input1],
      outputs: [output1, output2],
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    }

    const transaction2updated: TransactionData = {
      txid: 'transaction2',
      hex: '',
      blockHeight: 10,
      date: unixTime(new Date(20_000).getTime()),
      fees: '1',
      inputs: [input1],
      outputs: [output1, output2],
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    }

    await dataLayer.saveTransaction({
      tx: transaction1,
      scriptPubkeys: [output1.scriptPubkey]
    })
    await dataLayer.saveTransaction({
      tx: transaction2,
      scriptPubkeys: [output2.scriptPubkey]
    })

    const txsByBlockHeight = await dataLayer.fetchTransactions({
      blockHeight: 1
    })
    expect(txsByBlockHeight.length).to.be.eqls(2)
    expect(txsByBlockHeight[0]?.blockHeight).to.eqls(1)
    expect(txsByBlockHeight[1]?.blockHeight).to.eqls(1)

    await dataLayer.saveTransaction({ tx: transaction2updated })

    // should return for a single block height
    const txsByBlockHeight1 = await dataLayer.fetchTransactions({
      blockHeight: 1
    })
    expect(txsByBlockHeight1.length).to.be.eqls(1)
    expect(txsByBlockHeight1[0]?.blockHeight).to.eqls(1)

    // should return between (including) a range of block heights
    const txsByBlockHeight2 = await dataLayer.fetchTransactions({
      blockHeight: 1,
      blockHeightMax: 10
    })
    expect(txsByBlockHeight2.length).to.be.equals(2)

    // should return by a range of block heights from 0 to 10
    const txsByBlockHeight3 = await dataLayer.fetchTransactions({
      blockHeightMax: 10
    })
    expect(txsByBlockHeight3.length).to.be.equals(2)
    expect(txsByBlockHeight3[0]?.blockHeight).to.be.equals(10)
  })
})
