export interface TaskCache<T> {
  add: (key: string, value: T) => void
  clear: () => void
  get: (key: string) => T | undefined
  keys: string[]
  entries: Array<[string, T]>
  remove: (key: string) => void
  size: number
}

export const makeTaskCache = <T>(): TaskCache<T> => {
  let cache: { [key: string]: T } = {}
  let size = 0

  return {
    add: (key: string, value: T) => {
      cache[key] = value
      ++size
    },
    clear: () => {
      cache = {}
    },
    get: (key: string) => {
      return cache[key]
    },
    get keys() {
      return Object.keys(cache)
    },
    get entries() {
      return Object.entries(cache)
    },
    remove: (key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete cache[key]
      --size
    },
    get size() {
      return size
    }
  }
}
