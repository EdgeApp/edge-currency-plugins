type QueueFunction = () => Promise<any>
interface IQueue {
  add: (fn: QueueFunction) => void
}

export function makeQueue(): IQueue {
  let running = false
  const queue: QueueFunction[] = []

  async function run() {
    running = true

    const fn = queue.shift()
    await fn?.()

    if (queue.length > 0) {
      await run()
    }

    running = false
  }

  return {
    add(fn: QueueFunction) {
      queue.push(fn)
      !running && run()
    }
  }
}
