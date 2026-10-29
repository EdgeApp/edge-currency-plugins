import { expect } from 'chai'

import { pickNextTask } from '../../../../src/common/utxobased/engine/UtxoEngineProcessor'

type CommonParams = Parameters<typeof pickNextTask>[0]

describe('pickNextTask with addresses Electrum answered', function () {
  const makeCommon = (): {
    common: CommonParams
    reopened: string[][]
  } => {
    const reopened: string[][] = []
    const fakeCommon = {
      electrumHistoryAddresses: new Set(['address-1', 'address-2']),
      log: () => undefined,
      reopenAddresses: (addresses: Iterable<string>): number => {
        reopened.push([...addresses])
        return reopened[reopened.length - 1].length
      },
      serverStates: {
        getServerState: () => ({ blockSubscriptionStatus: 'unsubscribed' }),
        watchBlocks: () => undefined
      },
      taskCache: {
        addressForTransactionsCache: {},
        addressForUtxosCache: {},
        addressSubscribeCache: {},
        blockbookUtxoCache: {},
        dataLayerUtxoCache: {},
        transactionSpecificUpdateCache: {},
        transactionUpdateCache: {}
      }
    }
    // Only the parts pickNextTask reads before it subscribes to blocks:
    return { common: (fakeCommon as unknown) as CommonParams, reopened }
  }

  it('leaves them alone while an Electrum server picks tasks', async function () {
    const { common, reopened } = makeCommon()

    await pickNextTask(common, 'electrumws://localhost:50001').next()

    expect(reopened).to.deep.equal([])
    expect([...common.electrumHistoryAddresses]).to.deep.equal([
      'address-1',
      'address-2'
    ])
  })

  it('re-queues them once a Blockbook server picks a task', async function () {
    const { common, reopened } = makeCommon()

    await pickNextTask(common, 'wss://blockbook.example.com/websocket').next()

    expect(reopened).to.deep.equal([['address-1', 'address-2']])
    expect(common.electrumHistoryAddresses.size).to.equal(0)
  })
})
