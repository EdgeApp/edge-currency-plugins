import { EdgeCurrencyCodeOptions, EdgeCurrencyEngine } from 'edge-core-js'
import {
  EdgeDataDump,
  EdgeFreshAddress,
  EdgeGetTransactionsOptions,
  EdgePaymentProtocolInfo,
  EdgeSpendInfo,
  EdgeTokenInfo,
  EdgeTransaction,
  JsonObject,
} from 'edge-core-js/lib/types'
import * as bs from 'biggystring'
import * as bitcoin from 'altcoin-js'

import { EmitterEvent, EngineConfig, LocalWalletMetadata } from '../../plugin/types'
import { makeUtxoEngineState } from './makeUtxoEngineState'
import { makeProcessor } from '../db/Processor'
import { deriveAccount } from '../../plugin/makeCurrencyTools'
import { addressToScriptPubkey, makeTx, MakeTxTarget, signTx } from '../keymanager/keymanager'
import { calculateFeeRate } from './makeSpendHelper'
import { makePathFromString } from '../../Path'
import { makeBlockBook } from '../network/BlockBook'
import { ProcessorTransaction } from '../db/Models/ProcessorTransaction'

const localWalletDataPath = `metadata.json`

async function fetchLocalWalletMetadata(config: EngineConfig): Promise<LocalWalletMetadata> {
  try {
    const dataStr = await config.options.walletLocalDisklet.getText(localWalletDataPath)
    return JSON.parse(dataStr)
  } catch {
    const data: LocalWalletMetadata = {
      balance: '0',
      lastSeenBlockHeight: 0
    }
    await setLocalWalletMetadata(config, data)
    return data
  }
}

async function setLocalWalletMetadata(config: EngineConfig, data: LocalWalletMetadata): Promise<void> {
  await config.options.walletLocalDisklet.setText(localWalletDataPath, JSON.stringify(data))
}

export async function makeUtxoEngine(config: EngineConfig): Promise<EdgeCurrencyEngine> {
  const {
    info,
    walletInfo,
    io,
    options: {
      walletLocalDisklet,
      emitter
    }
  } = config


  const network = makeBlockBook({
    emitter
  })

  const metadata = await fetchLocalWalletMetadata(config)

  const processor = await makeProcessor({
    disklet: walletLocalDisklet,
    emitter
  })
  const account = deriveAccount(info, walletInfo)
  const state = makeUtxoEngineState({
    currencyInfo: info,
    processor,
    metadata,
    account,
    emitter,
    network
  })

  emitter.on(EmitterEvent.PROCESSOR_TRANSACTION_CHANGED, (tx: ProcessorTransaction) => {
    console.log('tx change:', tx)
    emitter.emit(EmitterEvent.TRANSACTIONS_CHANGED, ([
      tx.toEdgeTransaction(info.currencyCode)
    ]))
  })

  emitter.on(EmitterEvent.BALANCE_CHANGED, async (currencyCode: string, nativeBalance: string) => {
    metadata.balance = nativeBalance
    await setLocalWalletMetadata(config, metadata)
  })

  emitter.on(EmitterEvent.BLOCK_HEIGHT_CHANGED, async (height: number) => {
    metadata.lastSeenBlockHeight = height
    await setLocalWalletMetadata(config, metadata)
  })

  const fns: EdgeCurrencyEngine = {
    async startEngine(): Promise<void> {
      await network.connect()

      const { bestHeight } = await network.fetchInfo()
      emitter.emit(EmitterEvent.BLOCK_HEIGHT_CHANGED, bestHeight)

      await state.start()
    },

    async killEngine(): Promise<void> {
      await state.stop()
      await network.disconnect()
    },

    getBalance(opts: EdgeCurrencyCodeOptions): string {
      return metadata.balance
    },

    getBlockHeight(): number {
      return metadata.lastSeenBlockHeight
    },

    addCustomToken(_token: EdgeTokenInfo): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    addGapLimitAddresses(_addresses: string[]): void {
    },

    async broadcastTx(transaction: EdgeTransaction): Promise<EdgeTransaction> {
      await network.broadcastTx(transaction)
      return transaction
    },

    changeUserSettings(_settings: JsonObject): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    disableTokens(_tokens: string[]): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    dumpData(): EdgeDataDump {
      return {
        walletId: walletInfo.id.split(' - ')[0],
        walletType: walletInfo.type,
        // walletFormat: walletInfo.keys && walletInfo.keys.format,
        // pluginType: pluginState.pluginId,
        data: {}
      }
    },

    enableTokens(_tokens: string[]): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    getDisplayPrivateSeed(): string | null {
      return null
    },

    getDisplayPublicSeed(): string | null {
      return null
    },

    getEnabledTokens(): Promise<string[]> {
      return Promise.resolve([])
    },

    getFreshAddress(_opts: EdgeCurrencyCodeOptions): EdgeFreshAddress {
      const freshAddress = state.getFreshChangeAddress()
      return {
        publicAddress: freshAddress
      }
    },

    getNumTransactions(_opts: EdgeCurrencyCodeOptions): number {
      return 0
    },

    getPaymentProtocolInfo(_paymentProtocolUrl: string): Promise<EdgePaymentProtocolInfo> {
      // @ts-ignore
      return Promise.resolve(undefined)
    },

    getTokenStatus(_token: string): boolean {
      return false
    },

    async getTransactions(opts: EdgeGetTransactionsOptions): Promise<EdgeTransaction[]> {
      const txs = await processor.fetchTransactions(opts)
      return txs.map((tx) => tx.toEdgeTransaction(info.currencyCode))
    },

    // @ts-ignore
    async isAddressUsed(address: string): Promise<boolean> {
      const scriptPubKey = addressToScriptPubkey({
        address,
        network: account.networkType,
        coin: account.coinName
      })

      const addressStr = await processor.fetchAddressPathBySPubKey(scriptPubKey)
      if (addressStr) {
        const path = makePathFromString(addressStr)
        const address = await processor.fetchAddress(path)
        return address?.used ?? false
      }

      return false
    },

    async makeSpend(edgeSpendInfo: EdgeSpendInfo): Promise<EdgeTransaction> {
      if (!account.isPrivate()) {
        throw new Error('Action invalid for public account')
      }

      const targets: MakeTxTarget[] = []
      const ourReceiveAddresses: string[] = []
      for (const target of edgeSpendInfo.spendTargets) {
        if (!target.publicAddress || !target.nativeAmount) {
          throw new Error('Invalid spend target')
        }

        targets.push({
          address: target.publicAddress,
          value: parseInt(target.nativeAmount)
        })
      }

      const freshChangeAddress = await state.getFreshChangeAddress()
      const utxos = await processor.fetchAllUtxos()
      const feeRate = parseInt(calculateFeeRate(info, edgeSpendInfo))
      const tx = await makeTx({
        utxos,
        targets,
        feeRate,
        coin: account.coinName,
        network: account.networkType,
        rbf: false,
        freshChangeAddress
      })
      if (tx.changeUsed) {
        ourReceiveAddresses.push(freshChangeAddress)
      }

      let nativeAmount = '0'
      for (const output of tx.psbt.txOutputs) {
        const scriptPubKey = output.script.toString('hex')
        const own = await processor.hasSPubKey(scriptPubKey)
        if (!own) {
          nativeAmount = bs.sub(nativeAmount, output.value.toString())
        }
      }

      const networkFee = tx.fee.toString()
      nativeAmount = bs.sub(nativeAmount, networkFee)

      return {
        ourReceiveAddresses,
        otherParams: {
          psbt: tx.psbt.toBase64(),
          edgeSpendInfo
        },
        currencyCode: info.currencyCode,
        txid: '',
        date: 0,
        blockHeight: 0,
        nativeAmount,
        networkFee,
        feeRateUsed: {
          satPerVByte: feeRate
        },
        signedTx: ''
      }
    },

    resyncBlockchain(): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    saveTx(_transaction: EdgeTransaction): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    async signTx(transaction: EdgeTransaction): Promise<EdgeTransaction> {
      if (!account.isPrivate()) {
        throw new Error('Action invalid for public account')
      }

      const { psbt } = transaction!.otherParams!
      const inputs = bitcoin.Psbt.fromBase64(psbt).txInputs
      const privateKeys = await Promise.all(inputs.map(async ({ hash, index }) => {
        const txid = Buffer.isBuffer(hash) ? hash.reverse().toString('hex') : hash

        const utxo = await processor.fetchUtxo(`${txid}_${index}`)
        if (!utxo) throw new Error('Invalid UTXO')

        const pathStr = await processor.fetchAddressPathBySPubKey(utxo.scriptPubKey)
        if (!pathStr) throw new Error('Invalid script pubkey')

        const path = makePathFromString(pathStr)
        return account.getPrivateKey(path)
      }))
      transaction.signedTx = await signTx({
        psbt,
        coin: account.coinName,
        privateKeys
      })

      return transaction
    },

    sweepPrivateKeys(_spendInfo: EdgeSpendInfo): Promise<EdgeTransaction> {
      // @ts-ignore
      return Promise.resolve(undefined)
    }
  }

  return fns
}
