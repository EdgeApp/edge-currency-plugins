import { makeUtxoEngine } from '../../engine/makeUtxoEngine'
import type { EdgeCurrencyEngine, EdgeCurrencyEngineOptions } from 'edge-core-js/types'
import { payments, Psbt, networks } from 'bitcoinjs-lib'
import wif from 'wif'
import { mnemonicToSeedSync } from 'bip39'
import * as bip32 from 'bip32'

enum NetworkType {
  MAINNET = 'mainnet',
  TESTNET = 'testnet'
}

interface IKingPepeConfig {
  network?: NetworkType
  rpcUrl?: string
  rpcAuth?: {
    username: string
    password: string
  }
}

class RPCError extends Error {
  constructor(message: string, public code: number) {
    super(message)
    this.name = 'RPCError'
  }
}

export class KingPepePlugin {
  private pubKeyHash = 0x00
  private wif = 0x80
  private tokenSupportEnabled = false
  private address = ''
  private privateKeysObject: Record<string, any> = {}
  private balance = '0'
  private network: NetworkType
  private rpcUrl: string
  private rpcAuth: { username: string; password: string }

  constructor(config: IKingPepeConfig = {}) {
    this.network = config.network || NetworkType.MAINNET
    this.rpcUrl = config.rpcUrl || process.env.KPEPE_RPC_URL || 'http://127.0.0.1:22093'
    this.rpcAuth = config.rpcAuth || {
      username: process.env.KPEPE_RPC_USER || 'rpc_kingpepe',
      password: process.env.KPEPE_RPC_PASSWORD || 'default_pass'
    }
    if (this.network === NetworkType.TESTNET) {
      this.pubKeyHash = 0x6f
      this.wif = 0xef
    }
  }

  private getBitcoinJSNetwork() {
    return this.network === NetworkType.MAINNET ? networks.bitcoin : networks.testnet
  }

  async updateRpcConfig(url: string, auth: { username: string; password: string }) {
    this.rpcUrl = url
    this.rpcAuth = auth
  }

  private async rpcRequest(method: string, params: any[] = []): Promise<any> {
    const auth = Buffer.from(`${this.rpcAuth.username}:${this.rpcAuth.password}`).toString('base64')
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`
      },
      body: JSON.stringify({ jsonrpc: '1.0', id: 'edge', method, params })
    })

    if (!res.ok) throw new Error(`RPC status ${res.status}`)
    const data = await res.json()
    if (data.error) throw new RPCError(data.error.message, data.error.code)
    return data.result
  }

  async setPrivateKey(privateKey: string) {
    this.privateKeysObject = { privateKey }
    const keyBuffer = wif.decode(privateKey).privateKey
    const keyPair = bip32.fromPrivateKey(keyBuffer, Buffer.alloc(32), this.getBitcoinJSNetwork())
    const { address } = payments.p2pkh({ pubkey: keyPair.publicKey, network: this.getBitcoinJSNetwork() })
    this.address = address || ''
  }

  async setMnemonic(mnemonic: string, passphrase?: string) {
    const seed = mnemonicToSeedSync(mnemonic, passphrase)
    const root = bip32.fromSeed(seed, this.getBitcoinJSNetwork())
    this.privateKeysObject = { mnemonic, privateKey: root.toWIF() }
    this.address = this.deriveAddress(root, 0)
  }

  private deriveAddress(root: bip32.BIP32Interface, index: number): string {
    const child = root.derivePath(`m/44'/0'/0'/0/${index}`)
    const { address } = payments.p2pkh({ pubkey: child.publicKey, network: this.getBitcoinJSNetwork() })
    return address || ''
  }

  async getAddress(): Promise<string> {
    if (!this.address) throw new Error('Address not set')
    return this.address
  }

  async getBalance(): Promise<string> {
    if (!this.address) throw new Error('Address not set')
    const result = await this.rpcRequest('getreceivedbyaddress', [this.address])
    this.balance = result.toString()
    return this.balance
  }

  async createTransaction(toAddress: string, amount: number): Promise<string> {
    const unspent = await this.rpcRequest('listunspent', [0, 9999999, [this.address]])
    const total = unspent.reduce((sum: number, tx: any) => sum + tx.amount, 0)
    if (total < amount) throw new Error('Insufficient funds')

    const psbt = new Psbt({ network: this.getBitcoinJSNetwork() })
    unspent.forEach((utxo: any) => {
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: Buffer.from(utxo.scriptPubKey, 'hex'),
          value: Math.round(utxo.amount * 1e8)
        }
      })
    })

    psbt.addOutput({ address: toAddress, value: Math.round(amount * 1e8) })
    const change = total * 1e8 - amount * 1e8 - 1000
    if (change > 0) psbt.addOutput({ address: this.address, value: change })

    const root = bip32.fromBase58(this.privateKeysObject.privateKey, this.getBitcoinJSNetwork())
    psbt.signAllInputs(root)
    psbt.finalizeAllInputs()
    return psbt.extractTransaction().toHex()
  }

  enableTokenSupport(): void {
    this.tokenSupportEnabled = true
  }

  async getTokenBalance(tokenId: string): Promise<number> {
    if (!this.tokenSupportEnabled) throw new Error('Token support not enabled')
    return await this.rpcRequest('gettokenbalance', [this.address, tokenId])
  }

  async createTokenTransaction(tokenId: string, to: string, amount: number): Promise<string> {
    if (!this.tokenSupportEnabled) throw new Error('Token support not enabled')
    return await this.rpcRequest('sendtoken', [tokenId, this.address, to, amount])
  }

  async getBlockHeight(): Promise<number> {
    return await this.rpcRequest('getblockcount')
  }

  async getPepeRewards(): Promise<number> {
    return await this.rpcRequest('getblockreward')
  }
}

export function makeEngine(plugin: KingPepePlugin) {
  return async function engineFactory(input: EdgeCurrencyEngineOptions): Promise<EdgeCurrencyEngine> {
    const engine = await makeUtxoEngine({
      ...input,
      plugin,
      currencyInfo: {
        currencyCode: 'KPEPE',
        displayName: 'King Pepe',
        pluginType: 'utxo',
        walletType: 'wallet:kingpepe',
        denominations: [{ name: 'KPEPE', multiplier: '100000000', symbol: '♚' }],
        defaultSettings: {
          rpcUrls: [plugin['rpcUrl']],
          defaultNetworkFee: '1000'
        }
      },
      customMethods: {
        ...(plugin['tokenSupportEnabled']
          ? {
              getTokenBalance: plugin.getTokenBalance.bind(plugin),
              createTokenTransaction: plugin.createTokenTransaction.bind(plugin)
            }
          : {}),
        getPepeRewards: plugin.getPepeRewards.bind(plugin),
        getBlockHeight: plugin.getBlockHeight.bind(plugin),
        updateRpcConfig: plugin.updateRpcConfig.bind(plugin)
      }
    })

    const refreshInterval = setInterval(() => {
      engine.doRefreshUtxos().catch(() => {})
    }, 30000)

    engine.on('close', () => clearInterval(refreshInterval))
    return engine
  }
}
