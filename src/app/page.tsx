'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { AgentCard } from '@/components/AgentCard'
import { AddAgentModal } from '@/components/AddAgentModal'
import { RoadmapModal } from '@/components/RoadmapModal'
import { SetupWizard } from '@/components/SetupWizard'
import { SignalsPanel } from '@/components/SignalsPanel'

export default function Dashboard() {
  const { agents, filter, setupComplete, updateAgent, setFilter } = useStore()
  const [showRoadmap, setShowRoadmap] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch — only render after client store is loaded
  useEffect(() => { setMounted(true) }, [])

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
          <div className="flex items-center gap-1 mt-3">
            {[
              { v: 'all', l: `All (${agents.length})` },
              { v: 'running', l: 'Running' },
              { v: 'needs-input', l: 'Needs Input' },
              { v: 'reviewing', l: 'Reviewing' },
              { v: 'idle', l: 'Idle' },
              { v: 'done', l: 'Done' },
            ].map(f => (
              <button key={f.v} onClick={() => setFilter(f.v)} className="text-xs px-2 py-0.5 rounded transition-all"
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
        <div className="max-w-5xl mx-auto px-5 py-2 flex items-center justify-between text-xs opacity-30">
          <div className="flex items-center gap-4">
            <span>🟢 {agents.filter(a => a.status === 'running').length} running</span>
            <span>🟡 {agents.filter(a => a.status === 'needs-input').length} waiting</span>
            <span>⏸️ {agents.filter(a => a.status === 'idle').length} idle</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Avg score: {(() => { const s = agents.filter(a => a.score !== null); return s.length ? Math.round(s.reduce((t, a) => t + (a.score || 0), 0) / s.length) : '—' })()}</span>
            <span>localhost:4000</span>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showRoadmap && <RoadmapModal onClose={() => setShowRoadmap(false)} />}
      {showAdd && <AddAgentModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
