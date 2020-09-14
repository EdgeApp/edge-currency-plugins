import { CurrencyEngine, EngineConfig } from '../../plugin/CurrencyEngine'
import { Processor } from '../db/Processor'
import { UtxoEngineState } from './UtxoEngineState'
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

    this.state = new UtxoEngineState({
      currencyInfo: this.info,
      processor: this.processor,
      account: this.account
    })

    await this.state.load()
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

  public getBlockHeight(): number {
    return this.currentBlockHeight
  }

  private setBlockHeight(height: number) {
    this.currentBlockHeight = height
  }
}
