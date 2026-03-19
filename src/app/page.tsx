'use client'

import { useState, useCallback, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { AgentCard } from '@/components/AgentCard'
import { AddAgentModal } from '@/components/AddAgentModal'
import { RoadmapModal } from '@/components/RoadmapModal'
import { SetupWizard } from '@/components/SetupWizard'
import { SignalsPanel } from '@/components/SignalsPanel'
import { DiscoverModal } from '@/components/DiscoverModal'
import { QrModal } from '@/components/QrModal'
import { ReactionsPanel } from '@/components/ReactionsPanel'
import { DashboardHeader } from '@/components/DashboardHeader'
import { useSessionRecovery } from '@/hooks/useSessionRecovery'
import { useGitPolling } from '@/hooks/useGitPolling'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

export default function Dashboard() {
  const { agents, filter, setupComplete, setFilter, dailySpend } = useStore()
  const [showRoadmap, setShowRoadmap] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showDiscover, setShowDiscover] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useSessionRecovery()
  useGitPolling()

  const handleEscape = useCallback(() => {
    setShowRoadmap(false)
    setShowAdd(false)
    setShowDiscover(false)
    setShowQr(false)
  }, [])
  const handleRoadmap = useCallback(() => setShowRoadmap(true), [])
  useKeyboardShortcuts({ onEscape: handleEscape, onRoadmap: handleRoadmap })

  if (!mounted) return null
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
      <DashboardHeader
        agents={agents}
        filter={filter}
        attnCount={attnCount}
        runCount={runCount}
        onSetFilter={setFilter}
        onShowRoadmap={() => setShowRoadmap(true)}
        onShowAdd={() => setShowAdd(true)}
        onShowDiscover={() => setShowDiscover(true)}
        onShowQr={() => setShowQr(true)}
      />

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
