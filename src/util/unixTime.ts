export const unixTime = (ts: number = Date.now()): number =>
  Math.round(ts / 1000)
