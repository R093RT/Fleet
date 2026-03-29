import { describe, it, expect } from 'vitest'
import { pruneSignals, MAX_SIGNALS, RESOLVED_MAX_AGE_MS } from './signals'
import type { Signal } from './signals'

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: `sig-${Math.random().toString(36).slice(2, 6)}`,
    from: 'agent-a',
    to: 'agent-b',
    type: 'update',
    message: 'test',
    timestamp: Date.now(),
    resolved: false,
    ...overrides,
  }
}

describe('pruneSignals', () => {
  it('removes resolved signals older than 7 days', () => {
    const now = Date.now()
    const old = makeSignal({ resolved: true, timestamp: now - RESOLVED_MAX_AGE_MS - 1000 })
    const recent = makeSignal({ resolved: true, timestamp: now - 1000 })
    const result = pruneSignals([old, recent], now)
    expect(result).toHaveLength(1)
    expect(result[0]!.timestamp).toBe(recent.timestamp)
  })

  it('keeps unresolved signals regardless of age', () => {
    const now = Date.now()
    const ancient = makeSignal({ resolved: false, timestamp: now - RESOLVED_MAX_AGE_MS * 10 })
    const result = pruneSignals([ancient], now)
    expect(result).toHaveLength(1)
  })

  it('caps at MAX_SIGNALS keeping the most recent', () => {
    const now = Date.now()
    const signals = Array.from({ length: MAX_SIGNALS + 50 }, (_, i) =>
      makeSignal({ timestamp: now - (MAX_SIGNALS + 50 - i) * 1000 })
    )
    const result = pruneSignals(signals, now)
    expect(result).toHaveLength(MAX_SIGNALS)
    // Should keep the last MAX_SIGNALS (most recent)
    expect(result[0]!.timestamp).toBe(signals[50]!.timestamp)
  })

  it('returns empty array for empty input', () => {
    expect(pruneSignals([])).toEqual([])
  })
})
