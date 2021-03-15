import { Mutex } from 'async-mutex'

export type Mutexor = (name: string) => Mutex
export const makeMutexor = (): Mutexor => (name: string): Mutex => {
  const mutexes: { [name: string]: Mutex } = {}
  if (!mutexes[name]) {
    mutexes[name] = new Mutex()
  }
  return mutexes[name]
}
