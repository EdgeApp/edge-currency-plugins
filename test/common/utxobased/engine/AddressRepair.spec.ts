import { expect } from 'chai'
import { makeMemoryDisklet } from 'disklet'
import {
  EdgeCurrencyEngine,
  EdgeCurrencyEngineCallbacks,
  EdgeCurrencyPlugin,
  EdgeTxDatabase,
  JsonObject,
  makeMemoryTxDatabase
} from 'edge-core-js'

import { dataLayerTables } from '../../../../src/common/utxobased/db/DataLayer'
import { AddressData } from '../../../../src/common/utxobased/db/types'
import edgeCorePlugins from '../../../../src/index'
import { noOp, testLog } from '../../../util/testLog'
import {
  makeFakeIo,
  makeFakeNativeIo,
  makeMemoryPluginStore,
  makeReadOnlyDisklet
} from '../../../utils'

const WALLET_TYPE = 'wallet:litecoin'

// Litecoin's default wallet format is bip49, so every receive address sits
// on this branch:
const FIRST_PATH = { format: 'bip49', changeIndex: 0, addressIndex: 0 }

const callbacks: EdgeCurrencyEngineCallbacks = {
  onAddressChanged: noOp,
  onAddressesChecked: noOp,
  onBalanceChanged: noOp,
  onBlockHeightChanged: noOp,
  onNewTokens: noOp,
  onSeenTxCheckpoint: noOp,
  onStakingStatusChanged: noOp,
  onSubscribeAddresses: noOp,
  onSyncStatusChanged: noOp,
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
      pluginDatabase: makeMemoryPluginStore(),
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
    txDatabase: EdgeTxDatabase
  ): Promise<EdgeCurrencyEngine> =>
    await plugin.makeCurrencyEngine(
      { type: WALLET_TYPE, keys, id: '!' },
      {
        callbacks,
        log: testLog,
        legacyDisklet: makeReadOnlyDisklet(makeMemoryDisklet()),
        walletLocalEncryptedDisklet: makeReadOnlyDisklet(makeMemoryDisklet()),
        customTokens: {},
        enabledTokenIds: [],
        txDatabase,
        userSettings: {},
        walletSettings: {}
      }
    )

  // Runs the same initialization the core triggers when it loads a wallet:
  const initialize = async (engine: EdgeCurrencyEngine): Promise<void> => {
    await engine.addGapLimitAddresses([])
  }

  // Creates a wallet, lets it derive its first addresses, and returns its
  // database, opened on the engine's own tables:
  const makeSyncedDatabase = async (): Promise<EdgeTxDatabase> => {
    const db = await makeMemoryTxDatabase({
      walletId: Buffer.alloc(32, 0x33).toString('base64'),
      pluginId: 'litecoin'
    })
    await initialize(await makeEngine(db))
    await db.defineTables(dataLayerTables)
    return db
  }

  const readAddresses = async (db: EdgeTxDatabase): Promise<AddressData[]> =>
    (await db.findRows('address', {})) as AddressData[]

  const findFirstAddress = async (db: EdgeTxDatabase): Promise<AddressData> => {
    const [address] = (await db.findRows('address', {
      equals: {
        '$.path.format': FIRST_PATH.format,
        '$.path.changeIndex': FIRST_PATH.changeIndex,
        '$.path.addressIndex': FIRST_PATH.addressIndex
      }
    })) as AddressData[]
    expect(address).not.equals(undefined)
    return address
  }

  it('restores an address whose row is missing', async function () {
    const db = await makeSyncedDatabase()
    const original = await readAddresses(db)
    const first = await findFirstAddress(db)

    // The rows past it still count, so the next launch walks over the gap:
    await db.removeRows([{ table: 'address', keys: [first.scriptPubkey] }])

    await initialize(await makeEngine(db))

    const restored = await findFirstAddress(db)
    expect(restored.scriptPubkey).equals(first.scriptPubkey)
    expect(restored.redeemScript).equals(first.redeemScript)
    const byScript = (rows: AddressData[]): string[] =>
      rows.map(row => row.scriptPubkey)
    expect(byScript(await readAddresses(db))).to.include.members(
      byScript(original)
    )
  })

  it('retries initialization after it fails', async function () {
    const db = await makeSyncedDatabase()

    // Move the first address's script to another path. The repair derives
    // that script for the empty path, finds it taken, and refuses to move it:
    const first = await findFirstAddress(db)
    await db.putRows([
      {
        table: 'address',
        rows: [{ ...first, path: { ...FIRST_PATH, addressIndex: 999 } }]
      }
    ])

    const engine = await makeEngine(db)
    const outcomes: string[] = []
    for (let attempt = 0; attempt < 2; attempt++) {
      await engine.addGapLimitAddresses([]).then(
        () => outcomes.push('initialized'),
        () => outcomes.push('failed')
      )
    }
    expect(outcomes).deep.equals(['failed', 'failed'])
  })
})
