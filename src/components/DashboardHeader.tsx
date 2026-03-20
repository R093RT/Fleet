'use client'

import { useState, useEffect } from 'react'
import { useStore, type Agent } from '@/lib/store'
import { PT } from './PirateTerm'
import { AnchorIcon, CompassRose } from './PirateDecorations'
import { STATUS_OPTIONS } from './atoms'
import { usePirateClass } from '@/hooks/usePirateMode'

interface DashboardHeaderProps {
  agents: Agent[]
  filter: string
  attnCount: number
  runCount: number
  onSetFilter: (f: string) => void
  onShowRoadmap: () => void
  onShowAdd: () => void
  onShowDiscover: () => void
  onShowQr: () => void
}

const FILTER_TABS = [
  { v: 'all', l: (n: number) => `All (${n})`, pk: 'Full Crew' },
  { v: 'running', l: () => 'Running', pk: 'At Sea' },
  { v: 'needs-input', l: () => 'Needs Input', pk: 'Awaiting Orders' },
  { v: 'reviewing', l: () => 'Reviewing', pk: 'Scouting' },
  { v: 'idle', l: () => 'Idle', pk: 'Anchored' },
  { v: 'done', l: () => 'Done', pk: 'Docked' },
]

export function DashboardHeader({
  agents,
  filter,
  attnCount,
  runCount,
  onSetFilter,
  onShowRoadmap,
  onShowAdd,
  onShowDiscover,
  onShowQr,
}: DashboardHeaderProps) {
  const pirateFont = usePirateClass()
  const pirateMode = useStore(s => s.pirateMode)
  const setPirateMode = useStore(s => s.setPirateMode)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  const handleToggle = () => {
    const next = !pirateMode
    setPirateMode(next)
    setToast(next ? 'Arr! Pirate mode enabled' : 'Professional mode enabled')
  }

  return (
    <div className="border-b border-white/[0.06] sticky top-0 bg-surface/90 backdrop-blur-sm z-40">
      <div className="max-w-6xl mx-auto px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: pirateMode ? 'linear-gradient(135deg, #1a2332, #d4a843)' : 'linear-gradient(135deg, #1a2332, #3b82f6)' }}>
              {pirateMode ? <AnchorIcon size={20} /> : <span className="text-sm">⚡</span>}
            </div>
            <div>
              <h1 className={`${pirateFont} text-2xl tracking-wide text-amber`}>FLEET</h1>
              <div className="text-xs opacity-25 mt-0.5">
                <PT k="Captain's Quarters" />
                {' · '}{agents.length} agents · {runCount} running · git polling active
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {attnCount > 0 && (
              <button onClick={() => onSetFilter(filter === 'attention' ? 'all' : 'attention')}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                {attnCount} need{attnCount === 1 ? 's' : ''} attention
              </button>
            )}
            <button
              onClick={handleToggle}
              className="btn-ghost px-2.5 text-xs flex items-center gap-1.5"
              title={pirateMode ? 'Switch to professional mode' : 'Switch to pirate mode'}>
              {pirateMode ? '🏴‍☠️' : '💼'}
              <span className="hidden md:inline opacity-50">{pirateMode ? 'Pirate' : 'Pro'}</span>
            </button>
            <button onClick={onShowQr}
              className="btn-ghost px-2"
              title="Open Fleet on mobile">
              📱
            </button>
            <button onClick={onShowDiscover}
              className="btn-ghost">
              <PT k="Scout" className="border-0" />
            </button>
            <button onClick={onShowRoadmap}
              className="btn-ghost">
              🗺️ <PT k="Treasure Map" className="border-0" /> <span className="opacity-30 ml-1">Ctrl+Shift+R</span>
            </button>
            <button onClick={onShowAdd}
              className="btn-primary">
              <PT k="Recruit" className="border-0" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-0.5">
          {FILTER_TABS.map(f => (
            <button key={f.v} onClick={() => onSetFilter(f.v)}
              className="text-xs px-2 py-0.5 rounded transition-all flex-shrink-0"
              style={{
                backgroundColor: filter === f.v ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: filter === f.v ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
              }}>
              <PT k={f.pk} className="border-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Mode switch toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="px-4 py-2 rounded-lg bg-surface-raised border border-white/10 text-xs text-white/70 shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}
