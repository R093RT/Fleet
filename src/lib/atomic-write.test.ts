import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import path from 'path'
import { atomicWriteFileSync, safeReadJson } from './atomic-write'

const TMP_DIR = path.join(process.cwd(), '.test-atomic-write')

beforeEach(() => {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true })
})

describe('atomicWriteFileSync', () => {
  it('writes a file that can be read back', () => {
    const fp = path.join(TMP_DIR, 'test.json')
    atomicWriteFileSync(fp, JSON.stringify({ hello: 'world' }))
    expect(existsSync(fp)).toBe(true)
    expect(JSON.parse(readFileSync(fp, 'utf-8'))).toEqual({ hello: 'world' })
  })

  it('overwrites an existing file', () => {
    const fp = path.join(TMP_DIR, 'overwrite.json')
    atomicWriteFileSync(fp, '"first"')
    atomicWriteFileSync(fp, '"second"')
    expect(JSON.parse(readFileSync(fp, 'utf-8'))).toBe('second')
  })

  it('creates parent directories if needed', () => {
    const fp = path.join(TMP_DIR, 'nested', 'deep', 'file.json')
    atomicWriteFileSync(fp, '"ok"')
    expect(existsSync(fp)).toBe(true)
  })

  it('leaves no temp files on success', () => {
    const fp = path.join(TMP_DIR, 'clean.json')
    atomicWriteFileSync(fp, '"clean"')
    const files = require('fs').readdirSync(TMP_DIR) as string[]
    const tmpFiles = files.filter((f: string) => f.endsWith('.tmp'))
    expect(tmpFiles).toHaveLength(0)
  })
})

describe('safeReadJson', () => {
  it('returns parsed JSON from an existing file', () => {
    const fp = path.join(TMP_DIR, 'valid.json')
    atomicWriteFileSync(fp, JSON.stringify({ a: 1 }))
    expect(safeReadJson<{ a: number }>(fp)).toEqual({ a: 1 })
  })

  it('returns null for missing file', () => {
    expect(safeReadJson(path.join(TMP_DIR, 'nope.json'))).toBeNull()
  })

  it('returns null for corrupt JSON', () => {
    const fp = path.join(TMP_DIR, 'bad.json')
    atomicWriteFileSync(fp, '{not valid json')
    expect(safeReadJson(fp)).toBeNull()
  })
})
