import { Disklet } from 'disklet'
import {
  EdgeCurrencyCodeOptions,
  EdgeCurrencyEngine,
  EdgeCurrencyEngineOptions,
  EdgeCurrencyInfo,
  EdgeDataDump,
  EdgeFreshAddress,
  EdgeGetTransactionsOptions,
  EdgeIo,
  EdgePaymentProtocolInfo,
  EdgeSpendInfo,
  EdgeTokenInfo,
  EdgeTransaction,
  EdgeWalletInfo,
  JsonObject
} from 'edge-core-js/lib/types'

import { Account } from '../Account'
import { CurrencyTools } from './CurrencyTools'

export enum EngineCoinType {
  UTXO
}

export interface EngineCurrencyInfo extends EdgeCurrencyInfo {
  coinType: EngineCoinType
  network: string // The offical network in lower case - Needs to match the Bitcoin Lib Network Type
  gapLimit: number
  defaultFee: number
  feeUpdateInterval: number
  customFeeSettings: string[]
  simpleFeeSettings: {
    highFee: string
    lowFee: string
    standardFeeLow: string
    standardFeeHigh: string
    standardFeeLowAmount: string
    standardFeeHighAmount: string
  }
}

export interface EngineConfig {
  walletInfo: EdgeWalletInfo
  info: EngineCurrencyInfo
  tools: CurrencyTools
  options: EdgeCurrencyEngineOptions
  io: EdgeIo
}

interface ICurrencyEngine extends Omit<EngineConfig, 'options'> {}

export abstract class CurrencyEngine implements ICurrencyEngine, EdgeCurrencyEngine {
  public readonly walletInfo: EdgeWalletInfo
  public readonly info: EngineCurrencyInfo
  public readonly tools: CurrencyTools
  public readonly walletLocalDisklet: Disklet
  public readonly io: EdgeIo

  protected readonly account: Account
  protected isLoaded = false
  protected isRunning = false

  protected constructor(config: EngineConfig) {
    this.walletInfo = config.walletInfo
    this.info = config.info
    this.tools = config.tools
    this.walletLocalDisklet = config.options.walletLocalDisklet
    this.io = config.io
    // this.account = this.tools.deriveAccount(this.walletInfo)
    this.account = this.tools.buildAccount(this.walletInfo)
  }

  protected abstract async _load(): Promise<void>
  public async load(): Promise<void> {
    await this._load()

    this.isLoaded = true
  }

  protected abstract async _startEngine(): Promise<void>
  public async startEngine(): Promise<void> {
    if (this.isRunning) return
    if (!this.isLoaded) await this.load()

    this.isRunning = true

    await this._startEngine()
  }

  protected abstract async _killEngine(): Promise<void>
  public async killEngine(): Promise<void> {
    if (!this.isRunning) return

    await this._killEngine()

    this.isRunning = false
  }

  public addCustomToken(_token: EdgeTokenInfo): Promise<unknown> {
    return Promise.resolve(undefined)
  }

  public addGapLimitAddresses(_addresses: string[]): void {}

  public broadcastTx(transaction: EdgeTransaction): Promise<EdgeTransaction> {
    return Promise.resolve(transaction)
  }

  public changeUserSettings(_settings: JsonObject): Promise<unknown> {
    return Promise.resolve(undefined)
  }

  public disableTokens(_tokens: string[]): Promise<unknown> {
    return Promise.resolve(undefined)
  }

  public dumpData(): EdgeDataDump {
    return {
      walletId: this.walletInfo.id.split(' - ')[0],
      walletType: this.walletInfo.type,
      // walletFormat: this.walletInfo.keys && this.walletInfo.keys.format,
      // pluginType: this.pluginState.pluginId,
      // fees: this.fees,
      data: {
        //   ...this.pluginState.dumpData(),
        //   ...this.engineState.dumpData()
      }
    }
  }

  public enableTokens(_tokens: string[]): Promise<unknown> {
    return Promise.resolve(undefined)
  }

  public abstract getBalance(opts: EdgeCurrencyCodeOptions): string

  public abstract getBlockHeight(): number

  public getDisplayPrivateSeed(): string | null {
    return this.tools.getPrivateSeed(this.walletInfo)
  }

  public getDisplayPublicSeed(): string | null {
    return null
  }

  public getEnabledTokens(): Promise<string[]> {
    return Promise.resolve([])
  }

  public getFreshAddress(_opts: EdgeCurrencyCodeOptions): EdgeFreshAddress {
    // @ts-ignore
    return undefined
  }

  public getNumTransactions(_opts: EdgeCurrencyCodeOptions): number {
    return 0
  }

  public getPaymentProtocolInfo(_paymentProtocolUrl: string): Promise<EdgePaymentProtocolInfo> {
    // @ts-ignore
    return Promise.resolve(undefined)
  }

  public getTokenStatus(_token: string): boolean {
    return false
  }

  public getTransactions(_opts: EdgeGetTransactionsOptions): Promise<EdgeTransaction[]> {
    return Promise.resolve([])
  }

  public isAddressUsed(_address: string): boolean {
    return false
  }

  public makeSpend(_spendInfo: EdgeSpendInfo): Promise<EdgeTransaction> {
    // @ts-ignore
    return Promise.resolve(undefined)
  }

  public resyncBlockchain(): Promise<unknown> {
    return Promise.resolve(undefined)
  }

  public saveTx(_transaction: EdgeTransaction): Promise<unknown> {
    return Promise.resolve(undefined)
  }

  public signTx(_transaction: EdgeTransaction): Promise<EdgeTransaction> {
    // @ts-ignore
    return Promise.resolve(undefined)
  }

  public sweepPrivateKeys(_spendInfo: EdgeSpendInfo): Promise<EdgeTransaction> {
    // @ts-ignore
    return Promise.resolve(undefined)
  }
}
