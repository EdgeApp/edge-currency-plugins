/* eslint-disable @typescript-eslint/no-unused-expressions */
import * as chai from 'chai'
import { expect } from 'chai'
import { makeMemoryDisklet } from 'disklet'

import {
  makeProcessor,
  Processor
} from '../../../../src/common/utxobased/db/makeProcessor'
import {
  IAddress,
  IProcessorTransaction,
  ITransactionInput,
  ITransactionOutput,
  IUTXO
} from '../../../../src/common/utxobased/db/types'
import { ScriptTypeEnum } from '../../../../src/common/utxobased/keymanager/keymanager'

chai.should()

interface Fixtures {
  assertNumAddressesWithPaths: (expectedNum: number) => void
  assertLastUsedByFormatPath: (toBe: number | undefined) => Promise<void>
  assertNumTransactions: (expectedNum: number, processor: Processor) => void
  assertProcessorObjectNotUndefined: <T>(object: T | undefined) => T
  processor: Processor
}

const makeFixtures = async (): Promise<Fixtures> => {
  const storage = {}
  const disklet = makeMemoryDisklet(storage)
  const processor = await makeProcessor({ disklet })

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

    assertNumTransactions: (
      expectedNum: number,
      processor: Processor
    ): void => {
      const num = processor.numTransactions()
      expect(num).eql(expectedNum)
    },

    assertProcessorObjectNotUndefined: <T>(object: T | undefined): T => {
      if (object == null)
        throw new Error(`unable to retrieve from the processor`)
      return object
    },

    processor
  }
}

describe('Processor address tests', () => {
  it('empty address baselets', async () => {
    const {
      assertNumAddressesWithPaths,
      assertLastUsedByFormatPath,
      processor
    } = await makeFixtures()

    assertNumAddressesWithPaths(0)
    await assertLastUsedByFormatPath(undefined)

    expect(await processor.fetchAddress('doesnotexist')).to.be.undefined
    expect(
      await processor.fetchAddress({
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
      assertProcessorObjectNotUndefined,
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
    const processorAddress1 = assertProcessorObjectNotUndefined(
      await processor.fetchAddress(address1.scriptPubkey)
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
    const processorAddress2 = assertProcessorObjectNotUndefined(
      await processor.fetchAddress(address2.scriptPubkey)
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
    const processorAddress3 = await processor.fetchAddress(
      address3.scriptPubkey
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
    const processorAddress4 = assertProcessorObjectNotUndefined(
      await processor.fetchAddress(address4.scriptPubkey)
    )
    expect(processorAddress4.scriptPubkey).to.eqls(address4.scriptPubkey)
    await assertLastUsedByFormatPath(1)

    // check behavior of not found addresses in populated baselets:
    expect(await processor.fetchAddress('doesnotexist')).to.be.undefined
    expect(
      await processor.fetchAddress({
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
      assertProcessorObjectNotUndefined,
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
    const processorAddress1 = assertProcessorObjectNotUndefined(
      await processor.fetchAddress(address.scriptPubkey)
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
    const processorAddress2 = assertProcessorObjectNotUndefined(
      await processor.fetchAddress(address.scriptPubkey)
    )
    expect(processorAddress2.scriptPubkey).to.eqls(address.scriptPubkey)

    // Update the used flag of an existing address with a path
    address = { ...address, used: true }
    await processor.saveAddress(address)
    // Assertions
    assertNumAddressesWithPaths(1)
    const processorAddress3 = assertProcessorObjectNotUndefined(
      await processor.fetchAddress(address.scriptPubkey)
    )
    expect(processorAddress3.scriptPubkey).to.eqls(address.scriptPubkey)
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
    const processorAddress4 = assertProcessorObjectNotUndefined(
      await processor.fetchAddress(address.scriptPubkey)
    )
    expect(processorAddress4.scriptPubkey).to.eqls(address.scriptPubkey)
    expect(processorAddress4.networkQueryVal).to.eqls(1)
    expect(processorAddress4.lastQuery).to.eqls(1)
    expect(processorAddress4.lastTouched).to.eqls(1)
    expect(processorAddress4.balance).to.eqls('0')
  })
})

describe('Processor utxo tests', () => {
  it('insert utxo to baselets', async () => {
    const { processor } = await makeFixtures()

    // Insert a utxo
    const utxo1: IUTXO = {
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
    await processor.saveUtxo(utxo1)
    // Fetch all
    await processor.fetchUtxos({ utxoIds: [] }).then(utxos => {
      expect(utxos).to.eqls([utxo1])
    })
    // Fetch one
    await processor.fetchUtxos({ utxoIds: ['utxo000001'] }).then(utxos => {
      expect(utxos).to.eqls([utxo1])
    })

    // Insert a second utxo
    const utxo2: IUTXO = {
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
    await processor.saveUtxo(utxo2)
    // Fetch all
    await processor.fetchUtxos({ utxoIds: [] }).then(utxos => {
      expect(utxos).to.eqls([utxo1, utxo2])
    })
    // Fetch two
    await processor
      .fetchUtxos({ utxoIds: ['utxo000001', 'utxo000002'] })
      .then(utxos => {
        expect(utxos).to.eqls([utxo1, utxo2])
      })

    // Fetch by scriptPubkey
    await processor
      .fetchUtxos({ scriptPubkey: utxo1.scriptPubkey })
      .then(utxos => {
        expect(utxos).to.eqls([utxo1])
      })
    await processor
      .fetchUtxos({ scriptPubkey: utxo2.scriptPubkey })
      .then(utxos => {
        expect(utxos).to.eqls([utxo2])
      })
  })

  it('update utxo in baselets', async () => {
    const { processor } = await makeFixtures()

    // Insert a utxo
    const utxoOriginal: IUTXO = {
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
    await processor.saveUtxo(utxoOriginal)
    // Fetch all
    await processor.fetchUtxos({ utxoIds: [] }).then(utxos => {
      expect(utxos).to.eqls([utxoOriginal])
    })
    // Fetch one
    await processor.fetchUtxos({ utxoIds: ['utxo000001'] }).then(utxos => {
      expect(utxos).to.eqls([utxoOriginal])
    })

    // Insert a second utxo
    const utxoUpdated: IUTXO = {
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
    await processor.saveUtxo(utxoUpdated)
    // Fetch all
    await processor.fetchUtxos({ utxoIds: [] }).then(utxos => {
      expect(utxos).to.eqls([utxoUpdated])
    })
    // Fetch one
    await processor.fetchUtxos({ utxoIds: ['utxo000001'] }).then(utxos => {
      expect(utxos).to.eqls([utxoUpdated])
    })
  })

  it('remove utxo in baselets', async () => {
    const { processor } = await makeFixtures()

    // Insert a utxo
    const utxo: IUTXO = {
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
    await processor.saveUtxo(utxo)
    // Fetch all
    await processor.fetchUtxos({ utxoIds: [] }).then(utxos => {
      expect(utxos).to.eqls([utxo])
    })
    // Fetch all
    await processor.fetchUtxos({ utxoIds: ['utxo000001'] }).then(utxos => {
      expect(utxos).to.eqls([utxo])
    })
    // Fetch by scriptPubkey
    await processor
      .fetchUtxos({ scriptPubkey: utxo.scriptPubkey })
      .then(utxos => {
        expect(utxos).to.eqls([utxo])
      })

    // Remove utxo
    await processor.removeUtxos(['utxo000001'])
    // Fetch all
    await processor.fetchUtxos({ utxoIds: [] }).then(utxos => {
      expect(utxos).to.eqls([])
    })
    // Fetch one
    await processor.fetchUtxos({ utxoIds: ['utxo000001'] }).then(utxos => {
      expect(utxos).to.eqls([undefined])
    })
    // Fetch by scriptPubkey
    await processor
      .fetchUtxos({ scriptPubkey: utxo.scriptPubkey })
      .then(utxos => {
        expect(utxos).to.eqls([undefined])
      })
  })

  it('query all utxos in baselets', async () => {
    const { processor } = await makeFixtures()

    // Insert a utxo
    const utxos: IUTXO[] = [
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
      await processor.saveUtxo(utxo)
    }
    // Fetch all
    await processor.fetchUtxos({ utxoIds: [] }).then(utxos => {
      expect(utxos).to.eqls(utxos)
    })

    for (const utxo of utxos) {
      // Fetch by scriptPubkey
      await processor
        .fetchUtxos({ scriptPubkey: utxo.scriptPubkey })
        .then(utxos => {
          expect(utxos).to.eqls([utxo])
        })
    }
  })
})
describe('Processor transactions tests', () => {
  function assertNumTransactions(
    expectedNum: number,
    processor: Processor
  ): void {
    const num = processor.numTransactions()
    expect(num).eql(expectedNum)
  }

  it('empty transaction baselets', async () => {
    const storage = {}
    const disklet = makeMemoryDisklet(storage)

    const processor = await makeProcessor({ disklet })
    assertNumTransactions(0, processor)
  })

  it('insert a transaction to transaction baselets', async () => {
    const storage = {}
    const disklet = makeMemoryDisklet(storage)
    const processor = await makeProcessor({ disklet })

    const input1: ITransactionInput = {
      txId: 'random',
      outputIndex: 0,
      scriptPubkey: 'pubkeyin1',
      n: 0,
      amount: '1'
    }
    const output1: ITransactionOutput = {
      amount: '1',
      n: 0,
      scriptPubkey: 'pubkeyout1'
    }
    const output2: ITransactionOutput = {
      amount: '1',
      n: 1,
      scriptPubkey: 'pubkeyout2'
    }
    const transaction1: IProcessorTransaction = {
      txid: 'transaction1',
      hex: '',
      blockHeight: 1,
      date: new Date(10).getTime(),
      fees: '1',
      inputs: [input1],
      outputs: [output1, output2],
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    }

    await processor.saveTransaction({
      tx: transaction1,
      scriptPubkey: output1.scriptPubkey
    })

    assertNumTransactions(1, processor)
    const [tx1] = await processor.fetchTransactions({ txId: transaction1.txid })
    expect(tx1.ourOuts[0]).to.eqls('0')
    expect(tx1.ourAmount).to.eqls('1')
    const [txByBlockHeight1] = await processor.fetchTransactions({
      blockHeight: 1
    })
    expect(txByBlockHeight1.blockHeight).to.eqls(1)

    // insert the same transaction, but with a script pubkey referencing an input
    await processor.saveTransaction({
      tx: transaction1,
      scriptPubkey: input1.scriptPubkey
    })

    const [tx2] = await processor.fetchTransactions({ txId: transaction1.txid })
    expect(tx2.ourOuts[0]).to.eqls('0')
    expect(tx2.ourIns[0]).to.eqls('0')
    expect(tx2.ourAmount).to.eqls('0')

    // insert the same transaction, but with a script pubkey referencing another output
    await processor.saveTransaction({
      tx: transaction1,
      scriptPubkey: output2.scriptPubkey
    })

    const [tx3] = await processor.fetchTransactions({ txId: transaction1.txid })
    expect(tx3.ourOuts[1]).to.eqls('1')
    expect(tx3.ourIns[0]).to.eqls('0')
    expect(tx3.ourAmount).to.eqls('1')

    const [tx4] = await processor.fetchTransactions({ options: {} })
    expect(tx4).not.to.be.undefined

    await processor
      .fetchTransactions({
        options: { startDate: new Date(11), endDate: new Date(15) }
      })
      .should.be.rejectedWith(
        'At least one hash is required to query database.'
      )

    const [tx6] = await processor.fetchTransactions({
      options: {
        startDate: new Date(9),
        endDate: new Date(15)
      }
    })
    expect(tx6).not.to.be.undefined
  })

  it('insert multiple transactions to baselets', async () => {
    const storage = {}
    const disklet = makeMemoryDisklet(storage)
    const processor = await makeProcessor({ disklet })

    const input1: ITransactionInput = {
      txId: 'random',
      outputIndex: 0,
      scriptPubkey: 'pubkeyin1',
      n: 0,
      amount: '1'
    }
    const output1: ITransactionOutput = {
      amount: '1',
      n: 0,
      scriptPubkey: 'pubkeyout1'
    }
    const output2: ITransactionOutput = {
      amount: '1',
      n: 1,
      scriptPubkey: 'pubkeyout2'
    }
    const transaction1: IProcessorTransaction = {
      txid: 'transaction1',
      hex: '',
      blockHeight: 1,
      date: new Date(10).getTime(),
      fees: '1',
      inputs: [input1],
      outputs: [output1, output2],
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    }

    const transaction2: IProcessorTransaction = {
      txid: 'transaction2',
      hex: '',
      blockHeight: 1,
      date: new Date(20).getTime(),
      fees: '1',
      inputs: [input1],
      outputs: [output1, output2],
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    }

    await processor.saveTransaction({
      tx: transaction1,
      scriptPubkey: output1.scriptPubkey
    })
    await processor.saveTransaction({
      tx: transaction2,
      scriptPubkey: output2.scriptPubkey
    })

    assertNumTransactions(2, processor)
    const [tx1] = await processor.fetchTransactions({ txId: transaction1.txid })
    expect(tx1.ourOuts[0]).to.eqls('0')
    expect(tx1.ourAmount).to.eqls('1')
    const txsByBlockHeight = await processor.fetchTransactions({
      blockHeight: 1
    })
    expect(txsByBlockHeight[0].blockHeight).to.eqls(1)
    expect(txsByBlockHeight[1].blockHeight).to.eqls(1)

    await processor.saveTransaction({
      tx: transaction1,
      scriptPubkey: input1.scriptPubkey
    })

    const [tx2] = await processor.fetchTransactions({ txId: transaction1.txid })
    expect(tx2.ourOuts[0]).to.eqls('0')
    expect(tx2.ourIns[0]).to.eqls('0')
    expect(tx2.ourAmount).to.eqls('0')

    await processor.saveTransaction({
      tx: transaction1,
      scriptPubkey: output2.scriptPubkey
    })

    const [tx3] = await processor.fetchTransactions({ txId: transaction1.txid })
    expect(tx3.ourOuts[1]).to.eqls('1')
    expect(tx3.ourIns[0]).to.eqls('0')
    expect(tx3.ourAmount).to.eqls('1')

    const [tx4] = await processor.fetchTransactions({ options: {} })
    expect(tx4).not.to.be.undefined

    const [tx5] = await processor.fetchTransactions({
      options: {
        startDate: new Date(11),
        endDate: new Date(20)
      }
    })
    expect(tx5).not.to.be.undefined

    const tx6 = await processor.fetchTransactions({
      options: {
        startDate: new Date(9),
        endDate: new Date(21)
      }
    })
    expect(tx6.length).to.eqls(2)
  })

  it('update transaction blockheight in transaction baselets', async () => {
    const storage = {}
    const disklet = makeMemoryDisklet(storage)
    const processor = await makeProcessor({ disklet })

    const input1: ITransactionInput = {
      txId: 'random',
      outputIndex: 0,
      scriptPubkey: 'pubkeyin1',
      n: 0,
      amount: '1'
    }
    const output1: ITransactionOutput = {
      amount: '1',
      n: 0,
      scriptPubkey: 'pubkeyout1'
    }
    const output2: ITransactionOutput = {
      amount: '1',
      n: 1,
      scriptPubkey: 'pubkeyout2'
    }
    const transaction1: IProcessorTransaction = {
      txid: 'transaction1',
      hex: '',
      blockHeight: 1,
      date: new Date(10).getTime(),
      fees: '1',
      inputs: [input1],
      outputs: [output1, output2],
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    }

    const transaction2: IProcessorTransaction = {
      txid: 'transaction2',
      hex: '',
      blockHeight: 1,
      date: new Date(20).getTime(),
      fees: '1',
      inputs: [input1],
      outputs: [output1, output2],
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    }

    const transaction2updated: IProcessorTransaction = {
      txid: 'transaction2',
      hex: '',
      blockHeight: 10,
      date: new Date(20).getTime(),
      fees: '1',
      inputs: [input1],
      outputs: [output1, output2],
      ourIns: [],
      ourOuts: [],
      ourAmount: '0'
    }

    await processor.saveTransaction({
      tx: transaction1,
      scriptPubkey: output1.scriptPubkey
    })
    await processor.saveTransaction({
      tx: transaction2,
      scriptPubkey: output2.scriptPubkey
    })

    const txsByBlockHeight = await processor.fetchTransactions({
      blockHeight: 1
    })
    expect(txsByBlockHeight.length).to.be.eqls(2)
    expect(txsByBlockHeight[0].blockHeight).to.eqls(1)
    expect(txsByBlockHeight[1].blockHeight).to.eqls(1)

    await processor.saveTransaction({ tx: transaction2updated })

    // should return for a single block height
    const txsByBlockHeight1 = await processor.fetchTransactions({
      blockHeight: 1
    })
    expect(txsByBlockHeight1.length).to.be.eqls(1)
    expect(txsByBlockHeight1[0].blockHeight).to.eqls(1)

    // should return between (including) a range of block heights
    const txsByBlockHeight2 = await processor.fetchTransactions({
      blockHeight: 1,
      blockHeightMax: 10
    })
    expect(txsByBlockHeight2.length).to.be.equals(2)

    // should return by a range of block heights from 0 to 10
    const txsByBlockHeight3 = await processor.fetchTransactions({
      blockHeightMax: 10
    })
    expect(txsByBlockHeight3.length).to.be.equals(2)
    expect(txsByBlockHeight3[0].blockHeight).to.be.equals(10)
  })
})
