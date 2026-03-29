import {
  openSync,
  closeSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  existsSync,
  mkdirSync,
  statSync,
} from 'fs'
import path from 'path'

interface LockData {
  pid: number
  timestamp: number
}

interface FileLockOptions {
  /** Max time to wait for lock acquisition (default 10_000ms) */
  timeoutMs?: number
  /** Delay between retry attempts (default 100ms) */
  retryDelayMs?: number
  /** Lock age threshold for stale detection (default 30_000ms) */
  staleLockMs?: number
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function isLockStale(lockPath: string, staleLockMs: number): boolean {
  try {
    const stat = statSync(lockPath)
    const age = Date.now() - stat.mtimeMs
    if (age > staleLockMs) return true

    const raw = readFileSync(lockPath, 'utf-8')
    const data = JSON.parse(raw) as LockData
    return !isPidAlive(data.pid)
  } catch {
    return true // corrupt or unreadable = stale
  }
}

function tryAcquire(lockPath: string): boolean {
  try {
    const fd = openSync(lockPath, 'wx') // O_CREAT | O_EXCL
    try {
      const data: LockData = { pid: process.pid, timestamp: Date.now() }
      writeFileSync(fd, JSON.stringify(data))
    } finally {
      closeSync(fd)
    }
    return true
  } catch {
    return false
  }
}

/**
 * Execute `fn` while holding a file-based advisory lock.
 * Supports stale lock detection via PID liveness checks.
 */
export async function withFileLock<T>(
  lockPath: string,
  fn: () => T | Promise<T>,
  opts: FileLockOptions = {},
): Promise<T> {
  const { timeoutMs = 10_000, retryDelayMs = 100, staleLockMs = 30_000 } = opts

  const dir = path.dirname(lockPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const deadline = Date.now() + timeoutMs

  while (true) {
    if (tryAcquire(lockPath)) {
      try {
        return await fn()
      } finally {
        try {
          unlinkSync(lockPath)
        } catch {
          /* already gone */
        }
      }
    }

    // Clear stale locks
    if (isLockStale(lockPath, staleLockMs)) {
      try {
        unlinkSync(lockPath)
      } catch {
        /* race with another cleaner */
      }
      continue
    }

    if (Date.now() >= deadline) {
      throw new Error(`File lock timeout after ${timeoutMs}ms: ${lockPath}`)
    }

    await new Promise((r) => setTimeout(r, retryDelayMs))
  }
}
