/**
 * Gets an element out of an array but includes protection if the index
 * overflows the length of the array.
 **/
export const indexAtProtected = <T extends any[] | undefined>(
  array: T,
  index: number
): T extends Array<infer U> ? U : undefined =>
  array != null ? array[Math.min(index, array.length - 1)] : undefined
