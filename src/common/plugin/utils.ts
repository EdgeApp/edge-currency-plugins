import { all as plugins } from '../utxobased/info/all'

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

export const isError = (potentialError: any): potentialError is Error => {
  return (
    typeof potentialError.name === 'string' &&
    typeof potentialError.message === 'string' &&
    (potentialError.stack == null || typeof potentialError.stack === 'string')
  )
}
