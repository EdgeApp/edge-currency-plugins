// Wrapper class for a Promise with external resolve/reject functions
// Inspired by https://stackoverflow.com/questions/26150232/resolve-javascript-promise-outside-function-scope

export default class Deferred<T> {
  private _resolve: (value: T) => void = () => {
    return
  }

  private _reject: (reason?: unknown) => void = () => {
    return
  }

  private readonly _promise: Promise<T> = new Promise<T>((resolve, reject) => {
    this._reject = reject
    this._resolve = resolve
  })

  public get promise(): Promise<T> {
    return this._promise
  }

  public resolve(value: T): void {
    this._resolve(value)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public reject(reason?: unknown): void {
    this._reject(reason)
  }
}
