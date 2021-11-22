import { UtxoKeyFormat } from '../utxobased/engine/makeUtxoWalletTools'
import { all as plugins } from '../utxobased/info/all'

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

export const getFormatsForNetwork = (coinName: string): string[] => {
  for (const plugin of plugins) {
    if (plugin.coinInfo.name === coinName)
      return plugin.engineInfo.formats ?? []
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
