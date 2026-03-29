'use client'

import type { AgentStatus, Agent } from '@/lib/store'
import { AnchorIcon, ShipWheelIcon, SkullIcon, SpyglassIcon, FlagIcon } from './PirateDecorations'
import { PT } from './PirateTerm'

export const STATUS_OPTIONS: { value: AgentStatus; label: string; pirateLabel: string; color: string; pulse: boolean }[] = [
  { value: 'idle', label: 'Idle', pirateLabel: 'Anchored', color: '#4b5563', pulse: false },
  { value: 'running', label: 'Running', pirateLabel: 'Sailing', color: '#22c55e', pulse: true },
  { value: 'needs-input', label: 'Needs Input', pirateLabel: 'Awaiting Orders', color: '#f59e0b', pulse: true },
  { value: 'reviewing', label: 'Reviewing', pirateLabel: 'Scouting', color: '#3b82f6', pulse: false },
  { value: 'done', label: 'Done', pirateLabel: 'Docked', color: '#6b7280', pulse: false },
  { value: 'error', label: 'Error', pirateLabel: 'Shipwrecked', color: '#ef4444', pulse: true },
]

const STATUS_FALLBACK = { value: 'idle' as AgentStatus, label: 'Idle', pirateLabel: 'Anchored', color: '#4b5563', pulse: false }

function StatusIcon({ status, size = 12 }: { status: AgentStatus; size?: number }) {
  switch (status) {
    case 'idle': return <AnchorIcon size={size} className="flex-shrink-0" />
    case 'running': return <ShipWheelIcon size={size} className="flex-shrink-0 animate-spin-slow" />
    case 'needs-input': return <FlagIcon size={size} className="flex-shrink-0" />
    case 'reviewing': return <SpyglassIcon size={size} className="flex-shrink-0" />
    case 'done': return <span className="flex-shrink-0" style={{ fontSize: size * 0.8 }}>🏴‍☠️</span>
    case 'error': return <SkullIcon size={size} className="flex-shrink-0" />
    default: return <AnchorIcon size={size} className="flex-shrink-0" />
  }
}

export function StatusDot({ status }: { status: AgentStatus }) {
  const opt = STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_FALLBACK
  return (
    <span className="relative flex items-center gap-1.5" style={{ color: opt.color }} role="status" aria-label={`Status: ${opt.label}`}>
      <StatusIcon status={status} size={14} />
      {opt.pulse && <span className="absolute -left-0.5 -top-0.5 block w-4 h-4 rounded-full animate-ping opacity-20" style={{ backgroundColor: opt.color }} />}
    </span>
  )
}

export function StatusLabel({ status }: { status: AgentStatus }) {
  const opt = STATUS_OPTIONS.find(s => s.value === status) ?? STATUS_FALLBACK
  return (
    <span className="flex items-center gap-1.5" style={{ color: opt.color }}>
      <StatusIcon status={status} size={12} />
      <PT k={opt.pirateLabel} className="border-0" />
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
