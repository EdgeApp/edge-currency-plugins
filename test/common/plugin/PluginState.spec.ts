import { expect } from 'chai'
import { makeMemoryDisklet } from 'disklet'
import { makeFakeIo } from 'edge-core-js'

import {
  makePluginState,
  PluginState
} from '../../../src/common/plugin/PluginState'
import { makeFakeLog } from '../../utils'

const SERVERS = ['wss://a.test', 'wss://b.test', 'wss://c.test']

describe('PluginState server quarantine', function () {
  let pluginState: PluginState

  beforeEach(async () => {
    pluginState = makePluginState({
      currencyCode: 'BTC',
      defaultSettings: {
        blockbookServers: SERVERS,
        enableCustomServers: false
      },
      infoPayload: undefined,
      io: makeFakeIo(),
      log: makeFakeLog(),
      pluginDisklet: makeMemoryDisklet(),
      pluginId: 'bitcoin'
    })
    await pluginState.load()
  })

  it('serves every configured server by default', () => {
    expect(pluginState.getLocalServers(10)).to.have.members(SERVERS)
    expect(pluginState.isServerQuarantined('wss://a.test')).to.equal(false)
    expect(pluginState.hasQuarantinedServers()).to.equal(false)
  })

  it('withholds a quarantined server from getLocalServers', () => {
    pluginState.quarantineServer('wss://a.test')

    expect(pluginState.isServerQuarantined('wss://a.test')).to.equal(true)
    expect(pluginState.hasQuarantinedServers()).to.equal(true)
    expect(pluginState.getLocalServers(10)).to.have.members([
      'wss://b.test',
      'wss://c.test'
    ])
  })

  it('fills the wanted count from unquarantined servers', () => {
    pluginState.quarantineServer('wss://a.test')

    expect(pluginState.getLocalServers(2)).to.have.members([
      'wss://b.test',
      'wss://c.test'
    ])
  })

  it('releases a server once its quarantine expires', async () => {
    pluginState.quarantineServer('wss://a.test', 50)
    expect(pluginState.isServerQuarantined('wss://a.test')).to.equal(true)

    await new Promise(resolve => setTimeout(resolve, 75))

    expect(pluginState.isServerQuarantined('wss://a.test')).to.equal(false)
    expect(pluginState.hasQuarantinedServers()).to.equal(false)
    expect(pluginState.getLocalServers(10)).to.have.members(SERVERS)
  })

  it('lists live quarantines in dumpData without expired ones', async () => {
    pluginState.quarantineServer('wss://a.test')
    pluginState.quarantineServer('wss://b.test', 10)
    await new Promise(resolve => setTimeout(resolve, 25))

    expect(pluginState.dumpData().quarantinedServers).to.deep.equal([
      'wss://a.test'
    ])
  })
})
