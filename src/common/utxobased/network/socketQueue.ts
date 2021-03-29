const QUEUE_JOBS_PER_RUN = 3
const QUEUE_RUN_DELAY = 200

interface UpdateQueue {
  id: string
  action?: string
  updateFunc: Function
}

const updateQueue: UpdateQueue[] = []
let timeOut: NodeJS.Timeout

export function pushUpdate(update: UpdateQueue): void {
  if (updateQueue.length === 0) {
    startQueue()
  }
  let didUpdate = false
  for (const u of updateQueue) {
    if (u.id === update.id && u.action === update.action) {
      u.updateFunc = update.updateFunc
      didUpdate = true
      break
    }
  }
  if (!didUpdate) {
    updateQueue.push(update)
  }
}

export function removeIdFromQueue(id: string): void {
  for (let i = 0; i < updateQueue.length; i++) {
    const update = updateQueue[i]
    if (id === update.id) {
      updateQueue.splice(i, 1)
      break
    }
  }
  if (updateQueue.length === 0) {
    clearTimeout(timeOut)
  }
}

function startQueue(): void {
  timeOut = setTimeout(() => {
    const numJobs =
      QUEUE_JOBS_PER_RUN < updateQueue.length
        ? QUEUE_JOBS_PER_RUN
        : updateQueue.length
    for (let i = 0; i < numJobs; i++) {
      if (updateQueue.length > 0) {
        const u = updateQueue.shift()
        u?.updateFunc()
      }
    }
    if (updateQueue.length > 0) {
      startQueue()
    }
  }, QUEUE_RUN_DELAY)
}
