import { EdgeTransaction } from 'edge-core-js'

export abstract class Network {
  public abstract async connect(): Promise<void>

  public abstract async disconnect(): Promise<void>

  public abstract async fetchBlock(height?: number): Promise<any>

  public abstract async fetchAddress(address: string): Promise<any>

  public abstract async fetchTransaction(hash: string): Promise<any>

  public abstract async broadcastTx(transaction: EdgeTransaction): Promise<EdgeTransaction>
}