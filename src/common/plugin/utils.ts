import { UtxoKeyFormat } from '../utxobased/engine/makeUtxoWalletTools'
import { all as networks } from '../utxobased/info/all'

export const getMnemonicKey = ({ coin }: { coin: string }): string =>
  `${coin}Key`

export const getMnemonic = (args: {
  keys: UtxoKeyFormat
  coin: string
}): string => {
  const key = args.keys[getMnemonicKey(args)]
  if (key == null) throw new Error('Cannot derive key from watch-only wallet')
  return key
}

export const getFormatsForNetwork = (network: string): string[] => {
  for (const coin of networks) {
    if (coin.network === network) return coin.formats ?? []
  }
  return []
}

interface GenericObject<T> {
  [key: string]: T
}

export const removeItem = <T>(obj: GenericObject<T>, key: string): void => {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete obj[key]
}
