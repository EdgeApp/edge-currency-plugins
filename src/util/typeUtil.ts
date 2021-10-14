/**
 * Like Pick, but removed fields are optional.
 */
export type SoftPick<T, K extends keyof T> = Pick<T, K> & Partial<T>

/**
 * Like Omit, but removed fields are optional.
 */
export type SoftOmit<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
