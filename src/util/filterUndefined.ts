// Accepts an array of values and returns a new array of values without undefined values.
export const filterUndefined = <T>(values: Array<T | undefined>): T[] => {
  return values.filter(value => value !== undefined) as T[]
}

export const removeUndefined = <T extends Record<string, any>>(
  obj: T
): Partial<T> => {
  const result: Partial<T> = {}

  for (const key in obj) {
    if (obj[key] !== undefined) {
      // We need to assure TypeScript that the key indeed exists on T
      result[key as keyof T] = obj[key]
    }
  }

  return result
}
