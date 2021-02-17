import * as chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { makeMemoryDisklet } from 'disklet'

import { makeProcessor, Processor } from '../../../../src/common/utxobased/db/makeProcessor'
import { CurrencyFormat, NetworkEnum } from '../../../../src/common/plugin/types'
import {
  BitcoinWalletToolsConfig,
  makeUtxoWalletTools
} from '../../../../src/common/utxobased/engine/makeUtxoWalletTools'
import { EventEmitter } from 'events'

chai.should()
chai.use(chaiAsPromised)

describe('Processor', function() {
  const storage = {}
  const disklet = makeMemoryDisklet(storage)
  const emitter = new EventEmitter() as any
  let processor: Processor

  const format: CurrencyFormat = 'bip44'
  const walletToolsConfig: BitcoinWalletToolsConfig = {
    keys: {
      bitcoinKey: 'xprv9xpXFhFpqdQK3TmytPBqXtGSwS3DLjojFhTGht8gwAAii8py5X6pxeBnQ6ehJiyJ6nDjWGJfZ95WxByFXVkDxHXrqu53WCRGypk2ttuqncb',
      format,
      coinType: 0
    },
    coin: 'bitcoin',
    network: NetworkEnum.Mainnet
  }
  const walletTools = makeUtxoWalletTools(walletToolsConfig)

  before(async () => {
    processor = await makeProcessor({ disklet, emitter })
  })
})
