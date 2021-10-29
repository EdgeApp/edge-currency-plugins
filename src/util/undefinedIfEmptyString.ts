export const undefinedIfEmptyString = (str?: string): string | undefined =>
  str !== '' ? str : undefined
