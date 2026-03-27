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
import { CompassRose } from '@/components/PirateDecorations'
import { PT } from '@/components/PirateTerm'
import { VoyageProgress } from '@/components/VoyageProgress'
import { usePirateMode, usePirateClass, usePirateText } from '@/hooks/usePirateMode'
import { QmChatPanel } from '@/components/QmChatPanel'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function Dashboard() {
  const { agents, filter, setupComplete, setFilter, dailySpend, dailyBudgetCap, setDailyBudgetCap } = useStore()
  const isPirate = usePirateMode()
  const pirateFont = usePirateClass()
  const t = usePirateText()
  const [showRoadmap, setShowRoadmap] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showDiscover, setShowDiscover] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [showQmChat, setShowQmChat] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useSessionRecovery()
  useGitPolling()

  const handleEscape = useCallback(() => {
    setShowRoadmap(false)
    setShowAdd(false)
    setShowDiscover(false)
    setShowQr(false)
    setShowQmChat(false)
  }, [])
  const handleRoadmap = useCallback(() => setShowRoadmap(true), [])
  const handleQmChat = useCallback(() => setShowQmChat(v => !v), [])
  useKeyboardShortcuts({ onEscape: handleEscape, onRoadmap: handleRoadmap, onQmChat: handleQmChat })

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
    <div className="min-h-screen pb-12 relative pirate-transition">
      {/* Compass rose watermark — pirate mode only */}
      {isPirate && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0">
          <CompassRose size={500} className="text-amber opacity-[0.02]" />
        </div>
      )}

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
        onShowQmChat={handleQmChat}
        qmChatOpen={showQmChat}
      />

      {/* Voyage progress */}
      <VoyageProgress />

      {/* Signals bar */}
      <div className="max-w-6xl mx-auto px-5 pt-3">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.01]">
          <SignalsPanel />
        </div>
      </div>

      {/* Reactions bar */}
      <div className="max-w-6xl mx-auto px-5 pt-2">
        <ReactionsPanel />
      </div>

      {/* Onboarding nudge — shows when agents exist but none have been started */}
      {agents.length > 0 && runCount === 0 && agents.every(a => !a.sessionId && a.status === 'idle') && (
        <div className="max-w-6xl mx-auto px-5 pt-3">
          <div className="rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3 text-xs text-amber-400/70 flex items-start gap-2">
            <span className="mt-0.5">💡</span>
            <div>
              <span className="font-medium text-amber-400/90">{t('Ready to set sail!', 'Ready to start!')}</span>{' '}
              {t(
                'Click a pirate below, open the Terminal tab, and give yer first order to start working.',
                'Expand an agent below, switch to the Terminal tab, and enter a prompt to start working.'
              )}
              {agents.some(a => !a.path) && (
                <span className="block mt-1 text-red-400/60">
                  ⚠ Some agents have no repo path set — open their Config to set one before starting.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Agent list */}
      <div className="max-w-6xl mx-auto px-5 py-4 space-y-3">
        {filtered.map(a => (
          <ErrorBoundary key={a.id} label={a.name} compact>
            <AgentCard agent={a} />
          </ErrorBoundary>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-20 opacity-15 text-sm">
            {filter === 'all'
              ? <span className={`${pirateFont} text-lg`}>{t('No crew yet.', 'No agents yet.')} <button onClick={() => setShowAdd(true)} className="underline">{t('Recruit one.', 'Add one.')}</button></span>
              : <span className={`${pirateFont} text-lg`}>{t('No pirates match this filter.', 'No agents match this filter.')}</span>}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-white/[0.06] bg-surface/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-5 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-white/30">
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />{agents.filter(a => a.status === 'running').length} <PT k="At Sea" className="border-0" /></span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />{agents.filter(a => a.status === 'needs-input').length} <PT k="Awaiting Orders" className="border-0" /></span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-white/20 inline-block" />{agents.filter(a => a.status === 'idle').length} <PT k="Anchored" className="border-0" /></span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline opacity-30" title="Average Quality Score"><PT k="Morale" className="border-0" />: {(() => { const s = agents.filter(a => a.score !== null); return s.length ? Math.round(s.reduce((t, a) => t + (a.score || 0), 0) / s.length) : '—' })()}</span>
            {/* Daily spend + budget bar */}
            {(todaySpend > 0 || dailyBudgetCap != null) && (
              <span className={`tabular-nums font-mono flex items-center gap-1 ${dailyBudgetCap != null && todaySpend >= dailyBudgetCap ? 'text-red-400' : dailyBudgetCap != null && todaySpend >= dailyBudgetCap * 0.8 ? 'text-amber-400' : todaySpend > 2 ? 'text-red-400' : todaySpend > 0.5 ? 'text-amber-400' : 'opacity-30'}`}>
                {dailyBudgetCap != null && todaySpend >= dailyBudgetCap && (
                  <span className="text-red-400 animate-pulse" title="All agents blocked — daily budget reached">🚫</span>
                )}
                ${todaySpend.toFixed(4)}
                <span className="opacity-40">/</span>
                <span className="opacity-50" title="Daily fleet budget cap — click to edit">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={dailyBudgetCap ?? ''}
                  placeholder="∞"
                  onChange={e => setDailyBudgetCap(e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-10 bg-transparent border-b border-white/10 text-center tabular-nums font-mono outline-none text-inherit focus:text-white/60 focus:border-amber/40 placeholder:text-white/15"
                  title="Daily fleet budget cap (USD). Leave empty for unlimited."
                />
                <span className="opacity-30">today</span>
              </span>
            )}
            {totalSpend > todaySpend && totalSpend > 0 && (
              <span className="hidden sm:inline tabular-nums font-mono opacity-30">${totalSpend.toFixed(2)} total</span>
            )}
            <span className={`hidden sm:inline text-white/15 ${pirateFont}`}>Fleet · localhost:4000</span>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ErrorBoundary label="Modal" onDismiss={() => { setShowRoadmap(false); setShowAdd(false); setShowDiscover(false); setShowQr(false); setShowQmChat(false) }}>
        {showRoadmap && <RoadmapModal onClose={() => setShowRoadmap(false)} />}
        {showAdd && <AddAgentModal onClose={() => setShowAdd(false)} />}
        {showDiscover && <DiscoverModal onClose={() => setShowDiscover(false)} />}
        {showQr && <QrModal onClose={() => setShowQr(false)} />}
        {showQmChat && <QmChatPanel onClose={() => setShowQmChat(false)} onShowAdd={() => setShowAdd(true)} />}
      </ErrorBoundary>
    </div>
  )
}
