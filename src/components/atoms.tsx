'use client'

import type { AgentStatus, Agent } from '@/lib/store'

export const STATUS_OPTIONS: { value: AgentStatus; label: string; color: string; pulse: boolean }[] = [
  { value: 'idle', label: 'Idle', color: '#4b5563', pulse: false },
  { value: 'running', label: 'Running', color: '#22c55e', pulse: true },
  { value: 'needs-input', label: 'Needs Input', color: '#f59e0b', pulse: true },
  { value: 'reviewing', label: 'Reviewing', color: '#3b82f6', pulse: false },
  { value: 'done', label: 'Done', color: '#6b7280', pulse: false },
  { value: 'error', label: 'Error', color: '#ef4444', pulse: true },
]

const STATUS_FALLBACK = { value: 'idle' as AgentStatus, label: 'Idle', color: '#4b5563', pulse: false }

export function StatusDot({ status }: { status: AgentStatus }) {
  const opt = STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_FALLBACK
  return (
    <span className="relative flex items-center">
      <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
      {opt.pulse && <span className="absolute block w-2 h-2 rounded-full animate-ping opacity-40" style={{ backgroundColor: opt.color }} />}
    </span>
  )
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null
  const bg = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444'
  return <span className="text-xs font-bold rounded px-1.5 py-0.5 tabular-nums" style={{ backgroundColor: bg, color: '#fff' }}>{score}</span>
}

export function GitBadge({ git }: { git: Agent['git'] }) {
  if (!git) return <span className="text-xs opacity-20">no git</span>
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="opacity-40 font-mono">{git.branch}</span>
      {git.uncommitted > 0 && <span className="text-amber px-1 rounded bg-amber/10">{git.uncommitted} changed</span>}
      {git.unpushed > 0 && <span className="text-blue-400 px-1 rounded bg-blue-400/10">{git.unpushed} unpushed</span>}
    </div>
  )
}
