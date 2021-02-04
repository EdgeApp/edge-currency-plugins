
interface BatchFunctionsArgs {
  fns: (() => Promise<any>)[]
  batchSize: number
}

export const batchFunctions = async (args: BatchFunctionsArgs) => {
  const {
    fns,
    batchSize
  } = args

  while (fns.length > 0) {
    const chunk = fns.splice(0, batchSize)
    const chunkPromises = chunk.map((fn) => fn())
    await Promise.all(chunkPromises)
  }
}
