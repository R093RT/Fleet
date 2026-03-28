'use client'

import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { StreamingTerminal } from './StreamingTerminal'
import { StatusDot } from './atoms'
import { PT } from './PirateTerm'
import { usePirateClass, usePirateText } from '@/hooks/usePirateMode'

interface QmChatPanelProps {
  onClose: () => void
  onShowAdd: () => void
}

export function QmChatPanel({ onClose, onShowAdd }: QmChatPanelProps) {
  const { agents, expandedId, setExpanded } = useStore()
  const dailySpend = useStore(s => s.dailySpend)
  const pirateFont = usePirateClass()
  const t = usePirateText()
  const [showDelegate, setShowDelegate] = useState(false)
  const [delegateTo, setDelegateTo] = useState('')
  const [delegateMsg, setDelegateMsg] = useState('')
  const [delegateStatus, setDelegateStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const panelRef = useRef<HTMLDivElement>(null)

  const qm = agents.find(a => a.agentType === 'quartermaster')
  const workers = agents.filter(a => a.agentType !== 'quartermaster')
  const runCount = agents.filter(a => a.status === 'running').length
  const attnCount = agents.filter(a => a.status === 'needs-input').length
  const today = new Date().toISOString().slice(0, 10)
  const todaySpend = dailySpend[today] ?? 0

  // Collapse QM's AgentCard if it's expanded — prevents dual StreamingTerminal instances
  useEffect(() => {
    if (qm && expandedId === qm.id) {
      setExpanded(null)
    }
  // Only run on mount (when panel opens)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Clear delegation status toast after 2s
  useEffect(() => {
    if (delegateStatus === 'sent' || delegateStatus === 'error') {
      const t = setTimeout(() => setDelegateStatus('idle'), 2000)
      return () => clearTimeout(t)
    }
  }, [delegateStatus])

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Delay listener to avoid closing immediately from the button click that opened it
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handler)
    }
  }, [onClose])

  const sendDelegation = async () => {
    if (!qm || !delegateTo || !delegateMsg.trim()) return
    setDelegateStatus('sending')
    try {
      const res = await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: qm.name,
          to: delegateTo,
          type: 'handoff',
          message: delegateMsg.trim(),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setDelegateStatus('sent')
      setDelegateMsg('')
      setDelegateTo('')
      setShowDelegate(false)
    } catch {
      setDelegateStatus('error')
    }
  }

  return (
    <div ref={panelRef} className="fixed bottom-14 right-3 sm:right-5 w-[calc(100vw-1.5rem)] sm:w-[420px] z-30 rounded-lg border border-white/[0.08] bg-surface-raised shadow-2xl shadow-black/50 flex flex-col overflow-hidden animate-scale-in"
      style={{ height: 'min(500px, calc(100vh - 8rem))' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
        <span className="text-sm">⚓</span>
        <span className={`${pirateFont} text-amber text-sm flex-1`}>
          {qm ? qm.name : t('First Mate', 'Quartermaster')}
        </span>
        {qm && <StatusDot status={qm.status} />}
        {qm?.sessionCost != null && qm.sessionCost > 0 && (
          <span className="text-xs tabular-nums font-mono text-white/25">${qm.sessionCost.toFixed(4)}</span>
        )}
        <span className="text-xs opacity-20 ml-1 hidden sm:inline">Ctrl+Shift+Q</span>
        <button onClick={onClose} className="text-xs text-white/20 hover:text-white/60 transition-colors ml-1" title="Close">✕</button>
      </div>

      {/* Fleet status bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/5 text-xs text-white/30 flex-shrink-0">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          {runCount} {t('at sea', 'running')}
        </span>
        {attnCount > 0 && (
          <span className="flex items-center gap-1 text-amber-400/70">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
            {attnCount} {t('awaiting orders', 'needs input')}
          </span>
        )}
        {todaySpend > 0 && (
          <span className="tabular-nums font-mono opacity-60">${todaySpend.toFixed(4)} today</span>
        )}
      </div>

      {/* Main content */}
      {qm ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <StreamingTerminal agent={qm} fillHeight autoFocus />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="text-2xl opacity-20">⚓</span>
          <p className="text-xs text-white/40 leading-relaxed">
            {t(
              'No First Mate aboard. Assign a pirate as Quartermaster in their Configuration, or recruit one.',
              'No Quartermaster assigned. Set an agent\'s type to Quartermaster in its Configuration, or create one.'
            )}
          </p>
          <button onClick={onShowAdd} className="btn-primary text-xs">
            + {t('Recruit First Mate', 'Create QM')}
          </button>
        </div>
      )}

      {/* Quick actions footer */}
      {qm && (
        <div className="border-t border-white/5 flex-shrink-0">
          {/* Delegation feedback */}
          {delegateStatus === 'sent' && (
            <div className="px-3 py-1 text-xs text-green-400/80 bg-green-500/10">
              ✓ {t('Orders sent', 'Signal sent')}
            </div>
          )}
          {delegateStatus === 'error' && (
            <div className="px-3 py-1 text-xs text-red-400/80 bg-red-500/10">
              ✗ {t('Orders failed to send', 'Failed to send signal')}
            </div>
          )}
          {showDelegate ? (
            <div className="px-3 py-2 space-y-2">
              <div className="flex gap-2">
                <select
                  value={delegateTo}
                  onChange={e => setDelegateTo(e.target.value)}
                  className="flex-1 text-xs bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-white/60 outline-none"
                >
                  <option value="">To agent...</option>
                  {workers.map(a => (
                    <option key={a.id} value={a.name}>{a.icon} {a.name}</option>
                  ))}
                </select>
                <button onClick={() => setShowDelegate(false)} className="text-xs text-white/20 hover:text-white/50">cancel</button>
              </div>
              <div className="flex gap-2">
                <input
                  value={delegateMsg}
                  onChange={e => setDelegateMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && void sendDelegation()}
                  placeholder="Handoff message..."
                  className="flex-1 input-field-sm text-xs"
                />
                <button
                  onClick={() => void sendDelegation()}
                  disabled={!delegateTo || !delegateMsg.trim() || delegateStatus === 'sending'}
                  className="btn-primary text-xs px-3"
                >
                  {delegateStatus === 'sending' ? '...' : 'Send'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <button
                onClick={() => setShowDelegate(true)}
                className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400/70 border border-blue-500/15 hover:bg-blue-500/20 transition-all"
                title="Delegate a task to a worker agent"
              >
                <PT k="Send Orders" className="border-0" />
              </button>
              <span className="flex-1" />
              {qm.worktreeBranch && (
                <span className="text-[10px] font-mono text-purple-400/40">{qm.worktreeBranch}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
