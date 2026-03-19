'use client'

import type { Agent } from '@/lib/store'

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
  { v: 'all', l: (n: number) => `All (${n})` },
  { v: 'running', l: () => 'Running' },
  { v: 'needs-input', l: () => 'Needs Input' },
  { v: 'reviewing', l: () => 'Reviewing' },
  { v: 'idle', l: () => 'Idle' },
  { v: 'done', l: () => 'Done' },
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
  return (
    <div className="border-b border-white/6 sticky top-0 bg-surface/90 backdrop-blur-sm z-40">
      <div className="max-w-5xl mx-auto px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #1a2332, #d4a843)' }}>FL</div>
            <div>
              <h1 className="text-sm font-bold tracking-wide text-amber">FLEET</h1>
              <div className="text-xs opacity-25 mt-0.5">{agents.length} agents · {runCount} running · git polling active</div>
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
            <button onClick={onShowQr}
              className="text-xs px-2 py-1.5 rounded-lg bg-white/5 text-white/50 hover:text-white/90 border border-white/8 transition-all"
              title="Open Fleet on mobile">
              📱
            </button>
            <button onClick={onShowDiscover}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:text-white/90 border border-white/8 transition-all">
              Discover
            </button>
            <button onClick={onShowRoadmap}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:text-white/90 border border-white/8 transition-all">
              🗺️ Roadmap <span className="opacity-30 ml-1">Ctrl+Shift+R</span>
            </button>
            <button onClick={onShowAdd}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{ backgroundColor: 'rgba(212,168,67,0.12)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.2)' }}>
              + Agent
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
              {f.l(agents.length)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
