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

import { EngineConfig } from '../../plugin/types'

export async function makeUtxoEngine(config: EngineConfig): Promise<EdgeCurrencyEngine> {
  const fns: EdgeCurrencyEngine = {
    async startEngine(): Promise<void> {

    },

    async killEngine(): Promise<void> {

    },

    getBalance(opts: EdgeCurrencyCodeOptions): string {
      return ''
    },

    getBlockHeight(): number {
      return 0
    },

    addCustomToken(_token: EdgeTokenInfo): Promise<unknown> {
      return Promise.resolve(undefined)
    },

    addGapLimitAddresses(_addresses: string[]): void {
    },

    async broadcastTx(transaction: EdgeTransaction): Promise<EdgeTransaction> {
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
        walletId: '',
        walletType: '',
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
      return {
        publicAddress: '',
        legacyAddress: '',
        segwitAddress: ''
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
      return []
    },

    isAddressUsed(_address: string): boolean {
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
