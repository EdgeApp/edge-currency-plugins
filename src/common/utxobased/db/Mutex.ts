type Mutex = <T>(callback: () => Promise<T>) => Promise<T>

export function makeMutex(): Mutex {
  let busy = false
  const queue: Array<(value: unknown) => void> = []
  return async function lock<T>(callback: () => T | Promise<T>): Promise<T> {
    if (busy) await new Promise(resolve => queue.push(resolve))
    try {
      busy = true
      return callback()
    } finally {
      busy = false
      const resolve = queue.shift()
      if (resolve != null) resolve({})
    }
  }
}
