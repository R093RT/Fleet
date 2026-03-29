import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import path from 'path'
import { withFileLock } from './file-lock'

const TMP_DIR = path.join(process.cwd(), '.test-file-lock')
const LOCK_PATH = path.join(TMP_DIR, 'test.lock')

beforeEach(() => {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true })
})

describe('withFileLock', () => {
  it('executes the function and returns its result', async () => {
    const result = await withFileLock(LOCK_PATH, () => 42)
    expect(result).toBe(42)
  })

  it('works with async functions', async () => {
    const result = await withFileLock(LOCK_PATH, async () => {
      await new Promise((r) => setTimeout(r, 10))
      return 'async-result'
    })
    expect(result).toBe('async-result')
  })

  it('cleans up lock file after success', async () => {
    await withFileLock(LOCK_PATH, () => 'ok')
    expect(existsSync(LOCK_PATH)).toBe(false)
  })

  it('cleans up lock file after error', async () => {
    await expect(
      withFileLock(LOCK_PATH, () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(existsSync(LOCK_PATH)).toBe(false)
  })

  it('detects and clears stale locks from dead PIDs', async () => {
    // Write a stale lock with a PID that definitely doesn't exist
    writeFileSync(LOCK_PATH, JSON.stringify({ pid: 999999999, timestamp: Date.now() }))

    const result = await withFileLock(LOCK_PATH, () => 'recovered', { timeoutMs: 2000 })
    expect(result).toBe('recovered')
  })

  it('detects and clears old stale locks by timestamp', async () => {
    // Write a lock that's older than the stale threshold
    writeFileSync(
      LOCK_PATH,
      JSON.stringify({ pid: process.pid, timestamp: Date.now() - 60_000 }),
    )

    const result = await withFileLock(LOCK_PATH, () => 'cleared', {
      staleLockMs: 1000,
      timeoutMs: 2000,
    })
    expect(result).toBe('cleared')
  })

  it('times out when lock is held by a live process', async () => {
    // Write a fresh lock held by our own PID (alive)
    writeFileSync(
      LOCK_PATH,
      JSON.stringify({ pid: process.pid, timestamp: Date.now() }),
    )

    await expect(
      withFileLock(LOCK_PATH, () => 'never', { timeoutMs: 200, staleLockMs: 60_000 }),
    ).rejects.toThrow('File lock timeout')
  })

  it('allows sequential locks on the same path', async () => {
    const results: number[] = []
    await withFileLock(LOCK_PATH, () => results.push(1))
    await withFileLock(LOCK_PATH, () => results.push(2))
    await withFileLock(LOCK_PATH, () => results.push(3))
    expect(results).toEqual([1, 2, 3])
  })
})
