'use client'

import { useState } from 'react'
import { useReactions } from '@/hooks/useReactions'
import { PT } from './PirateTerm'

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

const STATUS_COLOR: Record<string, string> = {
  connected: '#22c55e',
  error: '#ef4444',
  'no-agent': '#ef4444',
  idle: 'rgba(255,255,255,0.15)',
}

const STATUS_TITLE: Record<string, string> = {
  connected: 'Watching for file changes',
  error: 'EventSource connection error',
  'no-agent': 'Agent not found or has no path',
  idle: 'Idle (port watcher or not yet connected)',
}

export function ReactionsPanel() {
  const { reactions, lastFired, error, enabled, setEnabled, fireReaction, reactionStatus } = useReactions()
  const [expanded, setExpanded] = useState(false)
  const [firing, setFiring] = useState<string | null>(null)

  const handleFire = (name: string) => {
    setFiring(name)
    fireReaction(name)
    setTimeout(() => setFiring(null), 1500)
  }

  // Hide entirely on fresh install (no fleet.yaml, no reactions)
  if (reactions.length === 0 && error && !expanded) {
    return null
  }

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.01]">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}>
        <span className="text-xs font-medium text-white/40">
          ⚡ <PT k="Standing Orders" /> ({reactions.length})
        </span>
        {error && (
          <span className="text-xs text-red-400/70 truncate" title={error}>
            ⚠ config error
          </span>
        )}
        <label
          className="ml-auto flex items-center gap-1.5 cursor-pointer"
          onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            className="accent-amber-500 w-3 h-3"
          />
          <span className="text-xs opacity-25">enabled</span>
        </label>
        <span className="text-xs opacity-15">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="border-t border-white/5 px-3 pb-3 pt-2">
          {reactions.length === 0 ? (
            <div className="space-y-1.5">
              <p className="text-xs text-white/25">
                No reactions configured. Add a <code className="font-mono text-white/40">fleet.yaml</code> to the Fleet root:
              </p>
              <pre className="text-[10px] text-white/20 font-mono leading-relaxed bg-white/3 rounded px-2 py-1.5 border border-white/5 overflow-x-auto">{`reactions:
  - name: "Test failure → fix"
    trigger:
      type: file_change
      agent: "Frontend"
      path: "test-results"
    action:
      type: send_prompt
      agent: "Frontend"
      message: "Tests changed — fix failures."
    cooldown: 300`}</pre>
            </div>
          ) : (
            <div className="space-y-1">
              {reactions.map(r => {
                const fired = lastFired[r.name]
                const status = reactionStatus[r.name] ?? 'idle'
                const isFiring = firing === r.name
                return (
                  <div key={r.name} className="flex items-center gap-2 text-xs group">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: STATUS_COLOR[status] ?? STATUS_COLOR['idle'] }}
                      title={STATUS_TITLE[status] ?? ''}
                    />
                    <span className="text-white/60 truncate min-w-0 max-w-[120px]">{r.name}</span>
                    <span className="text-white/20 truncate flex-1 min-w-0 hidden sm:block">
                      {r.trigger.type === 'file_change'
                        ? `watch ${r.trigger.agent}:${r.trigger.path ?? '*'}`
                        : `port ${r.trigger.port ?? '?'} down`}
                      {' → '}
                      {r.action.type === 'send_prompt' ? 'prompt' : r.action.status}
                    </span>
                    <span className="text-white/20 flex-shrink-0 tabular-nums">
                      {fired ? timeAgo(fired) : 'never'}
                    </span>
                    <button
                      onClick={() => handleFire(r.name)}
                      disabled={isFiring}
                      className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/25 hover:text-amber-400/80 hover:border-amber-500/30 transition-all disabled:opacity-50"
                      title="Fire this reaction now (bypasses cooldown)">
                      {isFiring ? '✓' : '▶'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
