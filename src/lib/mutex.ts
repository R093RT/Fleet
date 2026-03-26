/**
 * Simple in-process async mutex for serializing read-modify-write operations.
 * Not suitable for multi-process scenarios — Fleet is single-process by design.
 */
export function createMutex() {
  let locked = false
  const queue: (() => void)[] = []

  function release() {
    const next = queue.shift()
    if (next) {
      next()
    } else {
      locked = false
    }
  }

  return {
    async acquire(): Promise<() => void> {
      if (!locked) {
        locked = true
        return release
      }
      return new Promise<() => void>((resolve) => {
        queue.push(() => resolve(release))
      })
    },
  }
}
