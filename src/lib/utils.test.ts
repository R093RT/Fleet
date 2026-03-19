import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatTime } from './utils'

describe('formatTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "—" for null', () => {
    expect(formatTime(null)).toBe('—')
  })

  it('returns "—" for 0', () => {
    expect(formatTime(0)).toBe('—')
  })

  it('returns "just now" for timestamps less than 1 minute ago', () => {
    const ts = Date.now() - 30_000 // 30 seconds ago
    expect(formatTime(ts)).toBe('just now')
  })

  it('returns minutes ago for timestamps less than 1 hour ago', () => {
    const ts = Date.now() - 5 * 60_000 // 5 minutes ago
    expect(formatTime(ts)).toBe('5m ago')
  })

  it('returns hours ago for timestamps less than 1 day ago', () => {
    const ts = Date.now() - 3 * 60 * 60_000 // 3 hours ago
    expect(formatTime(ts)).toBe('3h ago')
  })

  it('returns locale date for timestamps older than 1 day', () => {
    const ts = Date.now() - 2 * 24 * 60 * 60_000 // 2 days ago
    const result = formatTime(ts)
    // Just verify it returns a string resembling a date (not the other cases)
    expect(result).not.toBe('just now')
    expect(result).not.toMatch(/m ago$/)
    expect(result).not.toMatch(/h ago$/)
    expect(result.length).toBeGreaterThan(0)
  })
})
