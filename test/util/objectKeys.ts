interface ObjectType {
  [key: string]: unknown
}

/**
 * A type safe way to get the keys of an object.
 */
export const objectKeys = <T extends ObjectType>(object: T): Array<keyof T> => {
  return Object.keys(object)
}
