<<<<<<< HEAD
=======
import { all as networks } from '../utxobased/info/all'

>>>>>>> master
export const getMnemonicKey = ({ coin }: { coin: string }): string =>
  `${coin}Key`

export const getMnemonic = (args: { keys: any; coin: string }): string =>
  args.keys[getMnemonicKey(args)]

export const getFormatsForNetwork = (network: string): string[] => {
  for (const coin of networks) {
    if (coin.network === network) return coin.formats ?? []
  }
  return []
}
