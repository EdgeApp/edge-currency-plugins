import { UtxoKeyFormat } from '../utxobased/engine/makeUtxoWalletTools'
import { all as networks } from '../utxobased/info/all'

export const getMnemonicKey = ({ coin }: { coin: string }): string =>
  `${coin}Key`

export const getMnemonic = (args: {
  keys: UtxoKeyFormat
  coin: string
}): string => args.keys[getMnemonicKey(args)]

export const getFormatsForNetwork = (network: string): string[] => {
  for (const coin of networks) {
    if (coin.network === network) return coin.formats ?? []
  }
  return []
}
