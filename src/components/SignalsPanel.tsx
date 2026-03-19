'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'

interface Signal {
  id: string
  from: string
  to: string
  type: 'handoff' | 'blocker' | 'update' | 'request' | 'done'
  message: string
  timestamp: number
  resolved: boolean
}

const TYPE_COLORS: Record<string, string> = {
  handoff: '#3b82f6',
  blocker: '#ef4444',
  update: '#22c55e',
  request: '#f59e0b',
  done: '#6b7280',
}

export function SignalsPanel() {
  const { agents } = useStore()
  const [signals, setSignals] = useState<Signal[]>([])
  const [showNew, setShowNew] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [type, setType] = useState<Signal['type']>('handoff')
  const [message, setMessage] = useState('')

  const loadSignals = async () => {
    try {
      const res = await fetch('/api/signals?unresolved=true')
      const data = await res.json()
      setSignals(data.signals || [])
    } catch {}
  }

  useEffect(() => {
    loadSignals()
    const interval = setInterval(loadSignals, 10000)
    return () => clearInterval(interval)
  }, [])

  const createSignal = async () => {
    if (!from || !to || !message.trim()) return
    try {
      await fetch('/api/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, type, message: message.trim() }),
      })
      setMessage('')
      setShowNew(false)
      loadSignals()
    } catch {}
  }

  const resolve = async (id: string) => {
    try {
      await fetch('/api/signals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId: id }),
      })
      loadSignals()
    } catch {}
  }

  if (signals.length === 0 && !showNew) {
    return (
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-xs opacity-20">No active signals</span>
        <button onClick={() => setShowNew(true)}
          className="text-xs px-2 py-1 rounded bg-white/5 text-white/40 hover:text-white/80 transition-all">
          + Signal
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs opacity-30 font-semibold">SIGNALS ({signals.length})</span>
        <button onClick={() => setShowNew(!showNew)}
          className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/40 hover:text-white/80 transition-all">
          {showNew ? 'Cancel' : '+ Signal'}
        </button>
      </div>

      {/* Create new signal */}
      {showNew && (
        <div className="p-3 rounded bg-white/3 border border-white/8 space-y-2">
          <div className="flex gap-2">
            <select value={from} onChange={e => setFrom(e.target.value)}
              className="flex-1 text-xs bg-white/5 border border-white/8 rounded px-2 py-1 text-white/80 outline-none">
              <option value="">From...</option>
              {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
            <select value={to} onChange={e => setTo(e.target.value)}
              className="flex-1 text-xs bg-white/5 border border-white/8 rounded px-2 py-1 text-white/80 outline-none">
              <option value="">To...</option>
              <option value="*">All agents</option>
              {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
            <select value={type} onChange={e => setType(e.target.value as Signal['type'])}
              className="text-xs bg-white/5 border border-white/8 rounded px-2 py-1 text-white/80 outline-none">
              <option value="handoff">Handoff</option>
              <option value="blocker">Blocker</option>
              <option value="request">Request</option>
              <option value="update">Update</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input value={message} onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createSignal()}
              placeholder="Signal message..."
              className="flex-1 text-xs bg-white/5 border border-white/8 rounded px-2 py-1 text-white/80 placeholder:text-white/20 outline-none" />
            <button onClick={createSignal} disabled={!from || !to || !message.trim()}
              className="text-xs px-3 py-1 rounded bg-amber/20 text-amber border border-amber/30 disabled:opacity-20 transition-all">
              Send
            </button>
          </div>
        </div>
      )}

      {/* Signal list */}
      {signals.map(s => (
        <div key={s.id} className="flex items-start gap-2 p-2 rounded bg-white/2 border border-white/5">
          <span className="text-xs px-1.5 py-0.5 rounded font-medium mt-0.5"
            style={{ backgroundColor: TYPE_COLORS[s.type] + '22', color: TYPE_COLORS[s.type] }}>
            {s.type}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs">
              <span className="opacity-50">{s.from}</span>
              <span className="opacity-20 mx-1">→</span>
              <span className="opacity-50">{s.to}</span>
            </div>
            <div className="text-xs text-white/70 mt-0.5">{s.message}</div>
            <div className="text-xs opacity-15 mt-0.5 tabular-nums">
              {new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button onClick={() => resolve(s.id)}
            className="text-xs px-2 py-0.5 rounded text-white/20 hover:text-green-400 hover:bg-green-500/10 transition-all flex-shrink-0">
            ✓
          </button>
        </div>
      ))}
    </div>
  )
}
