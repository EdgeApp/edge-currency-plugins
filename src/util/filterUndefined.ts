// Accepts an array of values and returns a new array of values without undefined values.
export const filterUndefined = <T>(values: Array<T | undefined>): T[] => {
  return values.filter(value => value !== undefined) as T[]
}
