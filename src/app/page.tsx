'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { AgentCard } from '@/components/AgentCard'
import { AddAgentModal } from '@/components/AddAgentModal'
import { RoadmapModal } from '@/components/RoadmapModal'
import { SetupWizard } from '@/components/SetupWizard'
import { SignalsPanel } from '@/components/SignalsPanel'
import { DiscoverModal } from '@/components/DiscoverModal'
import { QrModal } from '@/components/QrModal'
import { ReactionsPanel } from '@/components/ReactionsPanel'

export default function Dashboard() {
  const { agents, filter, setupComplete, updateAgent, setFilter, dailySpend } = useStore()
  const [showRoadmap, setShowRoadmap] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showDiscover, setShowDiscover] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch — only render after client store is loaded.
  // Also restore session stats from disk for agents that have none in localStorage
  // (e.g. after a localStorage clear) — a noop if stats are already present.
  useEffect(() => {
    setMounted(true)
    fetch('/api/sessions')
      .then(r => r.json())
      .then((data: { sessions?: Array<{ agentId: string; totalCost: number; totalRuns: number; totalTokens: number }> }) => {
        const currentAgents = useStore.getState().agents
        for (const s of data.sessions ?? []) {
          const agent = currentAgents.find(a => a.id === s.agentId)
          if (agent && agent.sessionCost === 0 && s.totalCost > 0) {
            useStore.getState().updateAgent(s.agentId, {
              sessionCost: s.totalCost,
              sessionTurns: s.totalRuns,
              sessionTokens: s.totalTokens > 0 ? s.totalTokens : null,
            })
          }
        }
      })
      .catch(() => {})
  }, [])

  // Poll git status every 15 seconds
  useEffect(() => {
    const poll = async () => {
      const paths = [...new Set(agents.map(a => a.path).filter(Boolean))]
      if (paths.length === 0) return
      try {
        const res = await fetch('/api/git-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths }),
        })
        const data = await res.json()
        for (const agent of agents) {
          if (data[agent.path]) {
            updateAgent(agent.id, { git: data[agent.path] })
          }
        }
      } catch {}
    }
    poll()
    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
  }, [agents.length])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowRoadmap(false)
        setShowAdd(false)
        setShowDiscover(false)
        setShowQr(false)
      }
      if (e.key === 'r' && e.ctrlKey && e.shiftKey) {
        e.preventDefault()
        setShowRoadmap(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!mounted) return null

  // Show setup wizard on first run
  if (!setupComplete) return <SetupWizard />

  const attnCount = agents.filter(a => a.status === 'needs-input' || (a.plan && a.planApproved === null)).length
  const runCount = agents.filter(a => a.status === 'running').length

  const today = new Date().toISOString().slice(0, 10)
  const todaySpend = dailySpend[today] ?? 0
  const totalSpend = Object.values(dailySpend).reduce((acc, v) => acc + v, 0)

  const filtered = filter === 'all' ? agents
    : filter === 'attention' ? agents.filter(a => a.status === 'needs-input' || (a.plan && a.planApproved === null))
    : agents.filter(a => a.status === filter)

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
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
                <button onClick={() => setFilter(filter === 'attention' ? 'all' : 'attention')}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                  style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                  {attnCount} need{attnCount === 1 ? 's' : ''} attention
                </button>
              )}
              <button onClick={() => setShowQr(true)}
                className="text-xs px-2 py-1.5 rounded-lg bg-white/5 text-white/50 hover:text-white/90 border border-white/8 transition-all"
                title="Open Fleet on mobile">
                📱
              </button>
              <button onClick={() => setShowDiscover(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:text-white/90 border border-white/8 transition-all">
                Discover
              </button>
              <button onClick={() => setShowRoadmap(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:text-white/90 border border-white/8 transition-all">
                🗺️ Roadmap <span className="opacity-30 ml-1">Ctrl+Shift+R</span>
              </button>
              <button onClick={() => setShowAdd(true)}
                className="text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ backgroundColor: 'rgba(212,168,67,0.12)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.2)' }}>
                + Agent
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-0.5">
            {[
              { v: 'all', l: `All (${agents.length})` },
              { v: 'running', l: 'Running' },
              { v: 'needs-input', l: 'Needs Input' },
              { v: 'reviewing', l: 'Reviewing' },
              { v: 'idle', l: 'Idle' },
              { v: 'done', l: 'Done' },
            ].map(f => (
              <button key={f.v} onClick={() => setFilter(f.v)} className="text-xs px-2 py-0.5 rounded transition-all flex-shrink-0"
                style={{ backgroundColor: filter === f.v ? 'rgba(255,255,255,0.08)' : 'transparent', color: filter === f.v ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)' }}>{f.l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Signals bar */}
      <div className="max-w-5xl mx-auto px-5 pt-3">
        <div className="rounded-lg border border-white/6 bg-white/[0.01]">
          <SignalsPanel />
        </div>
      </div>

      {/* Reactions bar */}
      <div className="max-w-5xl mx-auto px-5 pt-2">
        <ReactionsPanel />
      </div>

      {/* Agent list */}
      <div className="max-w-5xl mx-auto px-5 py-4 space-y-2">
        {filtered.map(a => <AgentCard key={a.id} agent={a} />)}
        {filtered.length === 0 && (
          <div className="text-center py-20 opacity-15 text-sm">
            {filter === 'all'
              ? <span>No agents yet. <button onClick={() => setShowAdd(true)} className="underline">Add one.</button></span>
              : 'No agents match this filter.'}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-white/6 bg-surface/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-5 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 opacity-30">
            <span>🟢 {agents.filter(a => a.status === 'running').length} running</span>
            <span>🟡 {agents.filter(a => a.status === 'needs-input').length} waiting</span>
            <span>⏸️ {agents.filter(a => a.status === 'idle').length} idle</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline opacity-30">Avg score: {(() => { const s = agents.filter(a => a.score !== null); return s.length ? Math.round(s.reduce((t, a) => t + (a.score || 0), 0) / s.length) : '—' })()}</span>
            {todaySpend > 0 && (
              <span className={`tabular-nums font-mono ${todaySpend > 2 ? 'text-red-400' : todaySpend > 0.5 ? 'text-amber-400' : 'opacity-30'}`}>
                ${todaySpend.toFixed(4)} today
              </span>
            )}
            {totalSpend > todaySpend && totalSpend > 0 && (
              <span className="hidden sm:inline tabular-nums font-mono opacity-30">${totalSpend.toFixed(2)} total</span>
            )}
            <span className="hidden sm:inline opacity-30">localhost:4000</span>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showRoadmap && <RoadmapModal onClose={() => setShowRoadmap(false)} />}
      {showAdd && <AddAgentModal onClose={() => setShowAdd(false)} />}
      {showDiscover && <DiscoverModal onClose={() => setShowDiscover(false)} />}
      {showQr && <QrModal onClose={() => setShowQr(false)} />}
    </div>
  )
}
