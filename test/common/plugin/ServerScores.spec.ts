// Typescript translation from original code in edge-currency-bitcoin

import { assert } from 'chai'
import { describe, it } from 'mocha'

import { ServerScores } from '../../../src/common/plugin/ServerScores'
import { makeFakeLog } from '../../utils'

describe(`ServerScores`, function () {
  const testLog = makeFakeLog()
  const callback = (_: string): void => {
    return
  }

  it('Score only', function () {
    const diskServerCache = {
      server1: {
        serverUrl: 'server1',
        serverScore: 500,
        responseTime: 10,
        numResponseTimes: 20
      },
      server2: {
        serverUrl: 'server2',
        serverScore: 100,
        responseTime: 10,
        numResponseTimes: 20
      },
      server3: {
        serverUrl: 'server3',
        serverScore: 300,
        responseTime: 10,
        numResponseTimes: 20
      },
      server4: {
        serverUrl: 'server4',
        serverScore: 200,
        responseTime: 10,
        numResponseTimes: 20
      },
      server5: {
        serverUrl: 'server5',
        serverScore: -190,
        responseTime: 10,
        numResponseTimes: 20
      },
      server6: {
        serverUrl: 'server6',
        serverScore: 50,
        responseTime: 10,
        numResponseTimes: 20
      },
      server7: {
        serverUrl: 'server7',
        serverScore: 500,
        responseTime: 10,
        numResponseTimes: 20
      },
      server8: {
        serverUrl: 'server8',
        serverScore: -10,
        responseTime: 10,
        numResponseTimes: 20
      }
    }
    const newServers = [
      'newServer1',
      'newServer2',
      'newServer3',
      'server1',
      'server2',
      'server3',
      'server4',
      'server5'
    ]

    const scores = new ServerScores({ log: testLog, onDirtyServer: callback })

    scores.serverScoresLoad(diskServerCache, newServers)
    const result = scores.getServers(diskServerCache, 8)

    const expected = [
      'server1',
      'server3',
      'server4',
      'server2',
      'newServer1',
      'newServer2',
      'newServer3',
      'server5'
    ]
    assert.equal(JSON.stringify(result), JSON.stringify(expected))
  })

  it('Bump score', function () {
    const diskServerCache = {
      server1: {
        serverUrl: 'server1',
        serverScore: 500,
        responseTime: 10,
        numResponseTimes: 20
      },
      server2: {
        serverUrl: 'server2',
        serverScore: 400,
        responseTime: 10,
        numResponseTimes: 20
      },
      server3: {
        serverUrl: 'server3',
        serverScore: 380,
        responseTime: 10,
        numResponseTimes: 20
      },
      server4: {
        serverUrl: 'server4',
        serverScore: 370,
        responseTime: 10,
        numResponseTimes: 20
      },
      server5: {
        serverUrl: 'server5',
        serverScore: 360,
        responseTime: 10,
        numResponseTimes: 20
      },
      server6: {
        serverUrl: 'server6',
        serverScore: 350,
        responseTime: 10,
        numResponseTimes: 20
      },
      server7: {
        serverUrl: 'server7',
        serverScore: 340,
        responseTime: 10,
        numResponseTimes: 20
      },
      server8: {
        serverUrl: 'server8',
        serverScore: -1,
        responseTime: 10,
        numResponseTimes: 20
      }
    }
    const newServers = [
      'server8',
      'server2',
      'server3',
      'server4',
      'server5',
      'server6',
      'server7'
    ]

    const scores = new ServerScores({ log: testLog, onDirtyServer: callback })

    scores.serverScoresLoad(diskServerCache, newServers)
    scores.serverScoreUp(diskServerCache, 'server8', 0, 405)
    const control = [
      'server8',
      'server2',
      'server3',
      'server4',
      'server5',
      'server6',
      'server7',
      'server1'
    ]
    const result = scores.getServers(diskServerCache, 8)
    assert.equal(JSON.stringify(result), JSON.stringify(control))
  })

  it('No old servers', function () {
    const diskServerCache = {
      server1: {
        serverUrl: 'server1',
        serverScore: 300,
        responseTime: 10,
        numResponseTimes: 20
      },
      server2: {
        serverUrl: 'server2',
        serverScore: 310,
        responseTime: 9,
        numResponseTimes: 20
      },
      server3: {
        serverUrl: 'server3',
        serverScore: 500,
        responseTime: 8,
        numResponseTimes: 20
      },
      server4: {
        serverUrl: 'server4',
        serverScore: -10,
        responseTime: 7,
        numResponseTimes: 20
      },
      server5: {
        serverUrl: 'server5',
        serverScore: 190,
        responseTime: 6,
        numResponseTimes: 20
      },
      server6: {
        serverUrl: 'server6',
        serverScore: 310,
        responseTime: 5,
        numResponseTimes: 20
      },
      server7: {
        serverUrl: 'server7',
        serverScore: 500,
        responseTime: 999999999,
        numResponseTimes: 0
      },
      server8: {
        serverUrl: 'server8',
        serverScore: -10,
        responseTime: 999999999,
        numResponseTimes: 0
      }
    }
    const newServers = ['newServer1', 'newServer2', 'newServer3']

    // $FlowFixMe
    const scores = new ServerScores({ log: testLog, onDirtyServer: callback })

    scores.serverScoresLoad(diskServerCache, newServers)
    const result = scores.getServers(diskServerCache, 8)

    const expected = [
      'newServer1',
      'newServer2',
      'newServer3',
      'server1',
      'server2',
      'server3',
      'server4',
      'server5'
    ]
    assert.equal(JSON.stringify(result), JSON.stringify(expected))
  })
})
