'use client'

import { useState, useEffect, useRef } from 'react'
import { useStore, type Agent, type AgentStatus } from '@/lib/store'
import { StreamingTerminal } from '@/components/StreamingTerminal'
import { DiffViewer } from '@/components/DiffViewer'
import { SignalsPanel } from '@/components/SignalsPanel'

// ─── Constants ───
const STATUS_OPTIONS: { value: AgentStatus; label: string; color: string; pulse: boolean }[] = [
  { value: 'idle', label: 'Idle', color: '#4b5563', pulse: false },
  { value: 'running', label: 'Running', color: '#22c55e', pulse: true },
  { value: 'needs-input', label: 'Needs Input', color: '#f59e0b', pulse: true },
  { value: 'reviewing', label: 'Reviewing', color: '#3b82f6', pulse: false },
  { value: 'done', label: 'Done', color: '#6b7280', pulse: false },
  { value: 'error', label: 'Error', color: '#ef4444', pulse: true },
]

const ICONS = ['⚙️','📍','🌿','📣','🧠','🔧','🚀','📊','🎨','🔬','📦','🛡️','💾','🌐','📱']
const COLORS = ['#2563eb','#3b82f6','#059669','#0d9488','#d97706','#7c3aed','#e11d48','#06b6d4','#84cc16','#f97316','#8b5cf6','#ec4899']

function formatTime(ts: number | null) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - ts) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return new Date(ts).toLocaleDateString()
}

// ─── Components ───

function StatusDot({ status }: { status: AgentStatus }) {
  const opt = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
  return (
    <span className="relative flex items-center">
      <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: opt.color }} />
      {opt.pulse && <span className="absolute block w-2 h-2 rounded-full animate-ping opacity-40" style={{ backgroundColor: opt.color }} />}
    </span>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null
  const bg = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444'
  return <span className="text-xs font-bold rounded px-1.5 py-0.5 tabular-nums" style={{ backgroundColor: bg, color: '#fff' }}>{score}</span>
}

function GitBadge({ git }: { git: Agent['git'] }) {
  if (!git) return <span className="text-xs opacity-20">no git</span>
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="opacity-40 font-mono">{git.branch}</span>
      {git.uncommitted > 0 && <span className="text-amber px-1 rounded bg-amber/10">{git.uncommitted} changed</span>}
      {git.unpushed > 0 && <span className="text-blue-400 px-1 rounded bg-blue-400/10">{git.unpushed} unpushed</span>}
    </div>
  )
}

function PreviewPanel({ agent }: { agent: Agent }) {
  const [port, setPort] = useState(agent.devPort?.toString() || '')
  const [path, setPath] = useState(agent.previewPath || '/')
  const [url, setUrl] = useState(agent.devPort ? `http://localhost:${agent.devPort}${agent.previewPath || '/'}` : '')
  const [key, setKey] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const load = () => { if (port) { setUrl(`http://localhost:${port}${path}`); setKey(k => k + 1) } }

  return (
    <div className="border-t border-white/5 bg-black/20">
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-xs opacity-30">localhost:</span>
        <input type="text" value={port} onChange={e => setPort(e.target.value.replace(/\D/g, ''))} placeholder="port"
          className="w-14 text-xs bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/80 placeholder:text-white/20 outline-none tabular-nums" />
        <input type="text" value={path} onChange={e => setPath(e.target.value)} placeholder="/"
          className="flex-1 text-xs bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/80 placeholder:text-white/20 outline-none font-mono" />
        <button onClick={load} className="text-xs px-2 py-0.5 rounded bg-white/8 text-white/60 hover:text-white border border-white/10 transition-all">Load</button>
        <button onClick={() => setKey(k => k + 1)} className="text-xs text-white/30 hover:text-white/80" title="Refresh">↻</button>
        <button onClick={() => ref.current?.requestFullscreen?.()} className="text-xs text-white/30 hover:text-white/80" title="Fullscreen">⛶</button>
      </div>
      {url ? (
        <div ref={ref} style={{ height: 450 }} className="relative">
          <iframe key={key} src={url} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
          <div className="absolute bottom-2 right-2 text-xs font-mono opacity-15 bg-black/60 px-1.5 py-0.5 rounded">{url}</div>
        </div>
      ) : (
        <div className="flex items-center justify-center text-xs opacity-15 py-20">Enter port + Load</div>
      )}
    </div>
  )
}

function AgentCard({ agent }: { agent: Agent }) {
  const { updateAgent, removeAgent, expandedId, setExpanded } = useStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tab, setTab] = useState<'control' | 'terminal' | 'diff' | 'preview'>('control')

  const isExpanded = expandedId === agent.id
  const highlight = agent.status === 'needs-input' || (agent.plan && agent.planApproved === null)

  return (
    <div className="rounded-lg border transition-all duration-200" style={{
      borderColor: highlight ? '#f59e0b' : 'rgba(255,255,255,0.06)',
      backgroundColor: highlight ? 'rgba(245,158,11,0.03)' : 'rgba(255,255,255,0.02)',
      boxShadow: highlight ? '0 0 0 1px rgba(245,158,11,0.12)' : 'none',
    }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none" onClick={() => setExpanded(isExpanded ? null : agent.id)}>
        <span className="text-lg flex-shrink-0">{agent.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: agent.color }}>{agent.name}</span>
            <span className="text-xs opacity-25">{agent.role}</span>
            <StatusDot status={agent.status} />
            <ScoreBadge score={agent.score} />
            {agent.plan && agent.planApproved === null && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">PLAN</span>}
            {agent.sessionId && <span className="text-xs px-1 py-0.5 rounded bg-green-500/10 text-green-500/60">live</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs opacity-35 truncate">{agent.task || 'No active task'}</span>
            <GitBadge git={agent.git} />
            {agent.lastUpdate && <span className="text-xs opacity-20">{formatTime(agent.lastUpdate)}</span>}
          </div>
        </div>
        <span className="text-xs opacity-15">{isExpanded ? '▲' : '▼'}</span>
      </div>

      {isExpanded && (
        <>
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-4 py-1 border-t border-white/5">
            {(['control', 'terminal', 'diff', 'preview'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="text-xs px-2.5 py-1 rounded transition-all capitalize"
                style={{
                  backgroundColor: tab === t ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: tab === t ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                }}>
                {t === 'terminal' ? '⌘ Terminal' : t === 'preview' ? '👁 Preview' : t === 'diff' ? '± Diff' : '⚙ Control'}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              {!confirmDelete
                ? <button onClick={() => setConfirmDelete(true)} className="text-xs px-2 py-1 text-white/15 hover:text-red-400 transition-all">✕ Remove</button>
                : <span className="flex items-center gap-1">
                    <button onClick={() => removeAgent(agent.id)} className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">Confirm</button>
                    <button onClick={() => setConfirmDelete(false)} className="text-xs text-white/30">cancel</button>
                  </span>
              }
            </div>
          </div>

          {/* Control tab */}
          {tab === 'control' && (
            <div className="px-4 pb-4 pt-2 space-y-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {STATUS_OPTIONS.map(s => (
                  <button key={s.value} onClick={() => updateAgent(agent.id, { status: s.value, lastUpdate: Date.now() })}
                    className="text-xs px-2 py-1 rounded transition-all" style={{
                      backgroundColor: agent.status === s.value ? s.color + '33' : 'rgba(255,255,255,0.03)',
                      color: agent.status === s.value ? s.color : '#555',
                      border: agent.status === s.value ? `1px solid ${s.color}44` : '1px solid transparent',
                    }}>{s.label}</button>
                ))}
              </div>

              <div>
                <label className="text-xs opacity-30 block mb-1">Task</label>
                <input type="text" value={agent.task} onChange={e => updateAgent(agent.id, { task: e.target.value, lastUpdate: Date.now() })}
                  placeholder="What is this agent working on?"
                  className="w-full text-sm bg-white/5 border border-white/8 rounded px-3 py-1.5 text-white/90 placeholder:text-white/15 outline-none focus:border-white/20" />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs opacity-30">Score</label>
                <input type="number" min="0" max="100" value={agent.score ?? ''}
                  onChange={e => updateAgent(agent.id, { score: e.target.value ? parseInt(e.target.value) : null, lastUpdate: Date.now() })}
                  className="w-16 text-sm text-center bg-white/5 border border-white/8 rounded px-2 py-1 text-white/90 placeholder:text-white/15 outline-none tabular-nums" />
                <span className="text-xs opacity-20">/ 100</span>
              </div>

              <div>
                <label className="text-xs opacity-30 block mb-1">Plan</label>
                <textarea value={agent.plan} onChange={e => updateAgent(agent.id, { plan: e.target.value })}
                  placeholder="Paste agent's plan..." rows={3}
                  className="w-full text-sm bg-white/5 border border-white/8 rounded px-3 py-1.5 text-white/90 placeholder:text-white/15 outline-none resize-y font-mono leading-relaxed" />
                {agent.plan && (
                  <div className="flex items-center gap-2 mt-1.5">
                    {agent.planApproved === null && <>
                      <button onClick={() => updateAgent(agent.id, { planApproved: true, status: 'running', lastUpdate: Date.now() })}
                        className="text-xs px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30">✓ Approve & Run</button>
                      <button onClick={() => updateAgent(agent.id, { planApproved: false, status: 'needs-input', lastUpdate: Date.now() })}
                        className="text-xs px-3 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">✗ Reject</button>
                    </>}
                    {agent.planApproved === true && <span className="text-xs text-emerald-400">✓ Approved <button onClick={() => updateAgent(agent.id, { planApproved: null })} className="opacity-50 hover:opacity-100 ml-1">(reset)</button></span>}
                    {agent.planApproved === false && <span className="text-xs text-red-400">✗ Rejected <button onClick={() => updateAgent(agent.id, { planApproved: null })} className="opacity-50 hover:opacity-100 ml-1">(reset)</button></span>}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs opacity-30 block mb-1">Notes</label>
                <textarea value={agent.notes} onChange={e => updateAgent(agent.id, { notes: e.target.value })}
                  placeholder="Blockers, observations..." rows={2}
                  className="w-full text-sm bg-white/5 border border-white/8 rounded px-3 py-1.5 text-white/90 placeholder:text-white/15 outline-none resize-y" />
              </div>

              {agent.git && (
                <div className="text-xs space-y-1 opacity-40">
                  <div>Last commit: <span className="text-white/60">{agent.git.lastCommit}</span></div>
                  <div className="font-mono opacity-60">{agent.path}</div>
                </div>
              )}
            </div>
          )}

          {/* Terminal tab */}
          {tab === 'terminal' && <StreamingTerminal agent={agent} />}

          {/* Diff tab */}
          {tab === 'diff' && <DiffViewer agent={agent} />}

          {/* Preview tab */}
          {tab === 'preview' && <PreviewPanel agent={agent} />}
        </>
      )}
    </div>
  )
}

function RoadmapModal({ onClose }: { onClose: () => void }) {
  const { roadmap, setRoadmap } = useStore()
  const [content, setContent] = useState(roadmap)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    fetch('/api/roadmap').then(r => r.json()).then(data => {
      if (data.exists && data.content) {
        setContent(data.content)
        setRoadmap(data.content)
      } else if (roadmap) {
        setContent(roadmap)
      } else if (data.content) {
        setContent(data.content)
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const save = async () => {
    setSaving(true)
    setRoadmap(content)
    try {
      const res = await fetch('/api/roadmap', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      setSaveMsg(data.error || 'Saved')
    } catch {
      setSaveMsg('Error saving')
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-raised border border-white/10 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
          <div className="flex items-center gap-2">
            <span>🗺️</span>
            <span className="text-sm font-semibold">Roadmap</span>
          </div>
          <div className="flex items-center gap-2">
            {saveMsg && <span className="text-xs opacity-50">{saveMsg}</span>}
            <button onClick={save} disabled={saving}
              className="text-xs px-3 py-1 rounded bg-amber/20 text-amber border border-amber/30 hover:bg-amber/30 disabled:opacity-30 transition-all">
              {saving ? 'Saving...' : 'Save to disk'}
            </button>
            <button onClick={onClose} className="text-xs opacity-30 hover:opacity-100 px-2 py-1">ESC</button>
          </div>
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)}
          className="flex-1 p-5 text-sm font-mono leading-relaxed bg-transparent text-white/80 outline-none resize-none"
          spellCheck={false} placeholder={loaded ? 'Set ROADMAP_PATH in .env to link a file...' : 'Loading...'} />
        <div className="px-5 py-2 border-t border-white/5 text-xs opacity-15">
          Configure path: set ROADMAP_PATH in .env
        </div>
      </div>
    </div>
  )
}

function AgentForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: { name: string; role: string; path: string; icon: string; color: string; devPort: string }
  submitLabel: string
  onSubmit: (v: { name: string; role: string; path: string; icon: string; color: string; devPort: string }) => void
  onCancel?: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [role, setRole] = useState(initial?.role || '')
  const [path, setPath] = useState(initial?.path || '')
  const [icon, setIcon] = useState(initial?.icon || '⚙️')
  const [color, setColor] = useState(initial?.color || '#2563eb')
  const [devPort, setDevPort] = useState(initial?.devPort || '')

  const isValid = name.trim() && path.trim()

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs opacity-30 block mb-1">Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Frontend" autoFocus
            className="w-full text-sm bg-white/5 border border-white/8 rounded px-3 py-1.5 text-white/90 placeholder:text-white/15 outline-none focus:border-white/20" />
        </div>
        <div className="flex-1">
          <label className="text-xs opacity-30 block mb-1">Role</label>
          <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. UI Components"
            className="w-full text-sm bg-white/5 border border-white/8 rounded px-3 py-1.5 text-white/90 placeholder:text-white/15 outline-none focus:border-white/20" />
        </div>
      </div>
      <div>
        <label className="text-xs opacity-30 block mb-1">Path to repo *</label>
        <input value={path} onChange={e => setPath(e.target.value)}
          placeholder="/Users/you/my-project  or  C:\Users\you\my-project"
          className="w-full text-sm bg-white/5 border border-white/8 rounded px-3 py-1.5 text-white/90 placeholder:text-white/15 outline-none font-mono focus:border-white/20" />
      </div>
      <div>
        <label className="text-xs opacity-30 block mb-1">Dev port <span className="opacity-50">(optional)</span></label>
        <input value={devPort} onChange={e => setDevPort(e.target.value.replace(/\D/g, ''))} placeholder="3000"
          className="w-24 text-sm bg-white/5 border border-white/8 rounded px-3 py-1.5 text-white/90 placeholder:text-white/15 outline-none tabular-nums" />
      </div>
      <div>
        <label className="text-xs opacity-30 block mb-1">Icon</label>
        <div className="flex gap-1 flex-wrap">
          {ICONS.map(i => <button key={i} onClick={() => setIcon(i)} className="w-8 h-8 rounded flex items-center justify-center text-base transition-all"
            style={{ backgroundColor: icon === i ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)', border: icon === i ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent' }}>{i}</button>)}
        </div>
      </div>
      <div>
        <label className="text-xs opacity-30 block mb-1">Color</label>
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map(c => <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded-full transition-all"
            style={{ backgroundColor: c, border: color === c ? '2px solid white' : '2px solid transparent', transform: color === c ? 'scale(1.15)' : '' }} />)}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && <button onClick={onCancel} className="text-xs px-3 py-1.5 text-white/30 hover:text-white/80">Cancel</button>}
        <button onClick={() => isValid && onSubmit({ name, role, path, icon, color, devPort })} disabled={!isValid}
          className="text-xs px-4 py-1.5 rounded font-medium disabled:opacity-20 transition-all"
          style={{ backgroundColor: 'rgba(212,168,67,0.2)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.3)' }}>
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

function AddAgentModal({ onClose }: { onClose: () => void }) {
  const { addAgent } = useStore()

  const handleSubmit = (v: { name: string; role: string; path: string; icon: string; color: string; devPort: string }) => {
    const repo = v.path.replace(/\\/g, '/').split('/').pop() || v.name
    addAgent({ name: v.name, role: v.role, repo, path: v.path, icon: v.icon, color: v.color, devPort: v.devPort ? parseInt(v.devPort) : null })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-raised border border-white/10 rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
          <span className="text-sm font-semibold">New Agent</span>
          <button onClick={onClose} className="text-xs opacity-30 hover:opacity-100">ESC</button>
        </div>
        <div className="p-5">
          <AgentForm submitLabel="Add Agent" onSubmit={handleSubmit} onCancel={onClose} />
        </div>
      </div>
    </div>
  )
}

function SetupWizard() {
  const { addAgent, setSetupComplete } = useStore()
  const [step, setStep] = useState<'welcome' | 'agent'>('welcome')

  const handleSubmit = (v: { name: string; role: string; path: string; icon: string; color: string; devPort: string }) => {
    const repo = v.path.replace(/\\/g, '/').split('/').pop() || v.name
    addAgent({ name: v.name, role: v.role, repo, path: v.path, icon: v.icon, color: v.color, devPort: v.devPort ? parseInt(v.devPort) : null })
    setSetupComplete(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface">
      <div className="w-full max-w-lg px-6">

        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                style={{ background: 'linear-gradient(135deg, #1a2332, #d4a843)' }}>FL</div>
              <div className="text-left">
                <h1 className="text-2xl font-bold tracking-wide text-amber">FLEET</h1>
                <p className="text-xs opacity-30">Claude Code agent command center</p>
              </div>
            </div>

            <div className="space-y-3 text-sm opacity-60 leading-relaxed text-left bg-white/[0.03] rounded-xl p-5 border border-white/6">
              <p>Fleet lets you run and coordinate multiple Claude Code agents across your local repos from a single dashboard.</p>
              <p>You can spawn agents, watch their terminal output live, review git diffs, approve plans, and send signals between agents.</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs opacity-30">Make sure you have Claude Code installed:</p>
              <code className="block text-xs bg-white/5 border border-white/8 rounded px-4 py-2 font-mono text-white/60">
                npm install -g @anthropic-ai/claude-code
              </code>
            </div>

            <button onClick={() => setStep('agent')}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{ backgroundColor: 'rgba(212,168,67,0.15)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.25)' }}>
              Get started →
            </button>
          </div>
        )}

        {step === 'agent' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('welcome')} className="text-xs opacity-30 hover:opacity-60">←</button>
              <div>
                <h2 className="text-sm font-semibold">Add your first agent</h2>
                <p className="text-xs opacity-30 mt-0.5">Point it at a local git repo</p>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/6 rounded-xl p-5">
              <AgentForm
                submitLabel="Launch Fleet →"
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ───
export default function Dashboard() {
  const { agents, filter, setupComplete, updateAgent, setFilter, setExpanded } = useStore()
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
