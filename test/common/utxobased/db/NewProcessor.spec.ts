/* eslint-disable @typescript-eslint/no-unused-expressions */
import * as chai from 'chai'
import { expect } from 'chai'
import { makeMemoryDisklet } from 'disklet'

import {
  makeNewProcessor,
  NewProcessor
} from '../../../../src/common/utxobased/db/newProcessor'
import {
  IProcessorTransaction,
  ITransactionInput,
  ITransactionOutput
} from '../../../../src/common/utxobased/db/types'

chai.should()

describe('Processor transactions tests', () => {
  function assertNumTransactions(
    expectedNum: number,
    processor: NewProcessor
  ): void {
    const num = processor.numTransactions()
    expect(num).eql(expectedNum)
  }

  it('empty transaction baselets', async () => {
    const storage = {}
    const disklet = makeMemoryDisklet(storage)

    const processor = await makeNewProcessor({ disklet })
    assertNumTransactions(0, processor)
  })

  it('insert a transaction to transaction baselets', async () => {
    const storage = {}
    const disklet = makeMemoryDisklet(storage)
    const processor = await makeNewProcessor({ disklet })

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

    await processor.insertTransaction({
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
    await processor.insertTransaction({
      tx: transaction1,
      scriptPubkey: input1.scriptPubkey
    })

    const [tx2] = await processor.fetchTransactions({ txId: transaction1.txid })
    expect(tx2.ourOuts[0]).to.eqls('0')
    expect(tx2.ourIns[0]).to.eqls('0')
    expect(tx2.ourAmount).to.eqls('0')

    // insert the same transaction, but with a script pubkey referencing another output
    await processor.insertTransaction({
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
    const processor = await makeNewProcessor({ disklet })

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

    await processor.insertTransaction({
      tx: transaction1,
      scriptPubkey: output1.scriptPubkey
    })
    await processor.insertTransaction({
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

    await processor.insertTransaction({
      tx: transaction1,
      scriptPubkey: input1.scriptPubkey
    })

    const [tx2] = await processor.fetchTransactions({ txId: transaction1.txid })
    expect(tx2.ourOuts[0]).to.eqls('0')
    expect(tx2.ourIns[0]).to.eqls('0')
    expect(tx2.ourAmount).to.eqls('0')

    await processor.insertTransaction({
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
    const processor = await makeNewProcessor({ disklet })

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

    await processor.insertTransaction({
      tx: transaction1,
      scriptPubkey: output1.scriptPubkey
    })
    await processor.insertTransaction({
      tx: transaction2,
      scriptPubkey: output2.scriptPubkey
    })

    const txsByBlockHeight = await processor.fetchTransactions({
      blockHeight: 1
    })
    expect(txsByBlockHeight.length).to.be.eqls(2)
    expect(txsByBlockHeight[0].blockHeight).to.eqls(1)
    expect(txsByBlockHeight[1].blockHeight).to.eqls(1)

    await processor.updateTransaction({
      txId: transaction2.txid,
      data: { blockHeight: 10 }
    })

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
