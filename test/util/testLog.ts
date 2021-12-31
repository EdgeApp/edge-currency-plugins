import { EdgeLog } from 'edge-core-js/types'

export const noOp = (..._args: any[]): void => undefined

export const testLog: EdgeLog = Object.assign((): void => undefined, {
  breadcrumb: noOp,
  crash: noOp,
  error: noOp,
  warn: noOp
})
