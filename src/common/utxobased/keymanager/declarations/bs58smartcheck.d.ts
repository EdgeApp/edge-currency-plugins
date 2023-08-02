declare module 'bs58smartcheck' {
  export const encode: (buffer: Buffer | number[] | Uint8Array) => string
  export const decodeUnsafe: (string: string) => Buffer | undefined
  export const decode: (string: string) => Buffer
}
