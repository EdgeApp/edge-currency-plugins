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

// Include a deprecated electrumServers field as a fallback for backwards
// compatibility with the old plugin.
// The new serverList field is the preferred API moving forward, however this
// allows for the new plugin to be a drop-in-replacement with the old plugin.
export const serverListFields = (
  serverList: string[]
): {
  serverList: string[]
  electrumServers: string[]
} => {
  return {
    serverList,
    get electrumServers() {
      console.warn('electrumServers is deprecated, use serverList instead.')
      return serverList
    }
  }
}
