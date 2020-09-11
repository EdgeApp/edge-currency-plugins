import { CurrencyEngine, EngineConfig } from '../../plugin/CurrencyEngine'
import { Processor } from '../db/Processor'
import { UtxoEngineState } from './UtxoEngineState'
import { Event } from '../../event/Emitter'
import { EdgeCurrencyCodeOptions } from 'edge-core-js'

export class UtxoEngine extends CurrencyEngine {
  private processor!: Processor
  private state!: UtxoEngineState
  private currentBalance: string = '0'
  private currentBlockHeight: number = 0

  constructor(config: EngineConfig) {
    super(config)
  }

  protected async _load(): Promise<any> {
    this.processor = await Processor.init(this.walletLocalDisklet)
    await this.checkBalance()

    this.state = new UtxoEngineState({
      currencyInfo: this.info,
      processor: this.processor,
      account: this.account
    })

    this.setupCallbacks()

    await this.state.load()
  }

  private setupCallbacks() {
    this.state.on(Event.TRANSACTIONS_CHANGED, this.callbacks.onTransactionsChanged)

    this.state.on(Event.BLOCK_HEIGHT_CHANGED, this.callbacks.onBlockHeightChanged)
    this.state.on(Event.BLOCK_HEIGHT_CHANGED, this.setBlockHeight.bind(this))

    this.state.on(Event.ADDRESSES_CHECKED, this.callbacks.onAddressesChecked)
    this.state.on(Event.ADDRESSES_CHECKED, this.checkBalance.bind(this))

    this.state.on(Event.TXIDS_CHANGED, this.callbacks.onTxidsChanged)
  }

  protected async _startEngine(): Promise<void> {
    await this.state.start()
  }

  public async _killEngine(): Promise<void> {
    await this.state.stop()
  }

  public getBalance(opts: EdgeCurrencyCodeOptions): string {
    return this.currentBalance
  }

  private async checkBalance() {
    const balance = await this.processor.fetchBalance()
    if (this.currentBalance !== balance) {
      this.callbacks.onBalanceChanged(this.info.currencyCode, balance)

      this.currentBalance = balance
    }
  }

  public getBlockHeight(): number {
    return this.currentBlockHeight
  }

  private setBlockHeight(height: number) {
    this.currentBlockHeight = height
  }
}
