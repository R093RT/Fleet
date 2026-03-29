export interface Signal {
  id: string
  from: string       // agent name
  to: string         // agent name or '*' for broadcast
  type: 'handoff' | 'blocker' | 'update' | 'request' | 'done'
  message: string
  timestamp: number
  resolved: boolean
}

export const MAX_SIGNALS = 500
export const RESOLVED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function pruneSignals(signals: Signal[], now = Date.now()): Signal[] {
  let pruned = signals.filter(s => !s.resolved || (now - s.timestamp) < RESOLVED_MAX_AGE_MS)
  if (pruned.length > MAX_SIGNALS) pruned = pruned.slice(-MAX_SIGNALS)
  return pruned
}
