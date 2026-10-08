import { expect } from 'chai'
import { Disklet, makeMemoryDisklet } from 'disklet'
import {
  EdgeCurrencyEngine,
  EdgeCurrencyEngineCallbacks,
  EdgeCurrencyPlugin,
  JsonObject
} from 'edge-core-js/types'

import edgeCorePlugins from '../../../../src/index'
import { noOp, testLog } from '../../../util/testLog'
import { makeFakeIo, makeFakeNativeIo } from '../../../utils'

const WALLET_TYPE = 'wallet:litecoin'

// Litecoin's default wallet format is bip49, so every receive address is a
// pay-to-script-hash script and lands in this one address bucket:
const ADDRESS_BUCKET = 'tables/addressByScriptPubkey/a914.json'
const PATH_BUCKET = 'tables/scriptPubkeyByPath/bip49_0/0.json'

// The DataLayer writes through a cache that flushes to disk on a timer:
const FLUSH_WAIT_MS = 500

const snooze = async (ms: number): Promise<void> =>
  await new Promise(resolve => setTimeout(resolve, ms))

const callbacks: EdgeCurrencyEngineCallbacks = {
  onAddressChanged: noOp,
  onAddressesChecked: noOp,
  onBalanceChanged: noOp,
  onBlockHeightChanged: noOp,
  onNewTokens: noOp,
  onSeenTxCheckpoint: noOp,
  onStakingStatusChanged: noOp,
  onTokenBalanceChanged: noOp,
  onTransactions: noOp,
  onTransactionsChanged: noOp,
  onTxidsChanged: noOp,
  onUnactivatedTokenIdsChanged: noOp,
  onWcNewContractCall: noOp
}

describe('UtxoEngineProcessor address repair', function () {
  this.timeout(20000)

  let plugin: EdgeCurrencyPlugin
  let keys: JsonObject

  before(async function () {
    const factory = edgeCorePlugins.litecoin
    if (typeof factory !== 'function') {
      throw new Error('Missing the litecoin plugin factory')
    }
    const corePlugin = factory({
      initOptions: {},
      io: makeFakeIo(),
      log: testLog,
      infoPayload: {},
      nativeIo: makeFakeNativeIo(),
      pluginDisklet: makeMemoryDisklet()
    })
    // The plugin factory returns the generic core plugin type:
    plugin = corePlugin as EdgeCurrencyPlugin
    const tools = await plugin.makeCurrencyTools()
    const privateKeys = await tools.createPrivateKey(WALLET_TYPE)
    const publicKeys = await tools.derivePublicKey({
      type: WALLET_TYPE,
      keys: privateKeys,
      id: '!'
    })
    keys = { ...privateKeys, ...publicKeys }
  })

  const makeEngine = async (
    walletLocalDisklet: Disklet
  ): Promise<EdgeCurrencyEngine> =>
    await plugin.makeCurrencyEngine(
      { type: WALLET_TYPE, keys, id: '!' },
      {
        callbacks,
        log: testLog,
        walletLocalDisklet,
        walletLocalEncryptedDisklet: walletLocalDisklet,
        customTokens: {},
        enabledTokenIds: [],
        userSettings: {}
      }
    )

  // Runs the same initialization the core triggers when it loads a wallet:
  const initialize = async (engine: EdgeCurrencyEngine): Promise<void> => {
    await engine.addGapLimitAddresses([])
    await snooze(FLUSH_WAIT_MS)
  }

  // Creates a wallet, lets it derive its first addresses, and returns its disk:
  const makeSyncedDisklet = async (): Promise<Disklet> => {
    const disklet = makeMemoryDisklet()
    await initialize(await makeEngine(disklet))
    return disklet
  }

  for (const bucket of [ADDRESS_BUCKET, PATH_BUCKET]) {
    it(`restores addresses after ${bucket} is cut short`, async function () {
      const disklet = await makeSyncedDisklet()
      const original = JSON.parse(await disklet.getText(bucket))
      expect(Object.keys(original)).length.greaterThan(0)

      // A process that dies in the middle of a write leaves an empty file:
      await disklet.setText(bucket, '')

      // The next launch finds the address count intact but no rows to match:
      await initialize(await makeEngine(disklet))

      const restored = JSON.parse(await disklet.getText(bucket))
      expect(restored).deep.equals(original)
    })
  }
})
