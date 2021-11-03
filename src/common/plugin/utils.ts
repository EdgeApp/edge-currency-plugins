import { UtxoKeyFormat } from '../utxobased/engine/makeUtxoWalletTools'
import { all as plugins } from '../utxobased/info/all'

export const getMnemonicKey = (coinName: string): string => `${coinName}Key`

export const getMnemonic = (keys: UtxoKeyFormat, coinName: string): string => {
  const key = keys[getMnemonicKey(coinName)]
  if (key == null) throw new Error('Cannot derive key from watch-only wallet')
  return key
}

export const getFormatsForNetwork = (network: string): string[] => {
  for (const plugin of plugins) {
    if (plugin.engineInfo.network === network)
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
