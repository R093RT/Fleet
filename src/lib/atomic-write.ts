import {
  writeFileSync,
  renameSync,
  unlinkSync,
  openSync,
  closeSync,
  fsyncSync,
  readFileSync,
  existsSync,
  mkdirSync,
} from 'fs'
import path from 'path'

/**
 * Crash-safe file write using the temp-rename pattern.
 * Writes to a temp file with exclusive flag, fsyncs, then atomically renames.
 */
export function atomicWriteFileSync(filePath: string, data: string): void {
  const dir = path.dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  try {
    const fd = openSync(tmpPath, 'wx') // exclusive create
    try {
      writeFileSync(fd, Buffer.from(data, 'utf-8'))
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    renameSync(tmpPath, filePath)
  } catch (e: unknown) {
    try {
      unlinkSync(tmpPath)
    } catch {
      /* already gone */
    }
    throw e
  }
}

/**
 * Safe JSON reader — returns null on missing file or parse error.
 */
export function safeReadJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T
  } catch {
    return null
  }
}
