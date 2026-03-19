'use client'

import { useState } from 'react'
import { useStore, type Agent } from '@/lib/store'
import { formatTime } from '@/lib/utils'
import { StreamingTerminal } from './StreamingTerminal'
import { DiffViewer } from './DiffViewer'
import { PreviewPanel } from './PreviewPanel'
import { StatusDot, ScoreBadge, GitBadge, STATUS_OPTIONS } from './atoms'

export function AgentCard({ agent }: { agent: Agent }) {
  const { updateAgent, removeAgent, expandedId, setExpanded } = useStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tab, setTab] = useState<'control' | 'terminal' | 'diff' | 'preview'>('control')

  const handleKill = async () => {
    await fetch('/api/kill', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id }),
    }).catch(() => {})
    updateAgent(agent.id, { status: 'idle', isStreaming: false, lastUpdate: Date.now() })
  }

  const handleRemove = async () => {
    // Clean up worktree
    if (agent.worktreePath) {
      try {
        await fetch('/api/worktree', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ worktreePath: agent.worktreePath, repoPath: agent.path }),
        })
      } catch {}
    }
    // Clean up session file on disk
    fetch('/api/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id }),
    }).catch(() => {})
    // Clean up screenshot files
    fetch('/api/screenshot', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id }),
    }).catch(() => {})
    removeAgent(agent.id)
  }

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
            {agent.worktreeBranch && <span className="text-xs px-1 py-0.5 rounded bg-purple-500/10 text-purple-400/60 font-mono">{agent.worktreeBranch}</span>}
            {agent.agentType === 'quartermaster' && <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400/80">⚓ QM</span>}
            {agent.budgetCap != null && agent.sessionCost >= agent.budgetCap && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">⚠ over budget</span>
            )}
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
          <div className="flex items-center gap-1 px-4 py-1 border-t border-white/5 overflow-x-auto">
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
            <div className="ml-auto flex items-center gap-2">
              {/* Kill button — visible from any tab when process is running */}
              {agent.status === 'running' && (
                <button onClick={handleKill}
                  className="text-xs px-2 py-1 text-red-400/50 hover:text-red-400 transition-all"
                  title="Kill the running claude process">
                  ✕ Kill
                </button>
              )}
              {!confirmDelete
                ? <button onClick={() => setConfirmDelete(true)} className="text-xs px-2 py-1 text-white/15 hover:text-red-400 transition-all">✕ Remove</button>
                : <span className="flex items-center gap-1">
                    <button onClick={handleRemove} className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">Confirm</button>
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

              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-xs opacity-30">Score</label>
                <input type="number" min="0" max="100" value={agent.score ?? ''}
                  onChange={e => updateAgent(agent.id, { score: e.target.value ? parseInt(e.target.value) : null, lastUpdate: Date.now() })}
                  className="w-16 text-sm text-center bg-white/5 border border-white/8 rounded px-2 py-1 text-white/90 placeholder:text-white/15 outline-none tabular-nums" />
                <span className="text-xs opacity-20">/ 100</span>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-xs opacity-30">Budget cap</label>
                <span className="text-xs opacity-30">$</span>
                <input type="number" min="0" step="0.1" value={agent.budgetCap ?? ''}
                  placeholder="none"
                  onChange={e => updateAgent(agent.id, { budgetCap: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-20 text-xs text-center bg-white/5 border border-white/8 rounded px-2 py-0.5 text-white/80 placeholder:text-white/20 outline-none tabular-nums" />
                <span className="text-xs opacity-20">USD / session</span>
                {agent.sessionCost > 0 && (
                  <span className={`text-xs tabular-nums font-mono ${agent.budgetCap != null && agent.sessionCost >= agent.budgetCap ? 'text-red-400' : agent.budgetCap != null && agent.sessionCost >= agent.budgetCap * 0.8 ? 'text-amber-400' : 'text-white/25'}`}>
                    ${agent.sessionCost.toFixed(4)} used
                  </span>
                )}
              </div>

              {/* Auto-iterate config */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" checked={agent.autoIterate}
                    onChange={e => updateAgent(agent.id, { autoIterate: e.target.checked })}
                    className="accent-amber-500" />
                  <span className="text-xs opacity-40">Auto-iterate</span>
                  <span className="text-xs opacity-20 cursor-help" title="After each task, Fleet auto-rates the output and iterates until the score meets the threshold or max rounds is reached">(?)</span>
                </label>
                {agent.autoIterate && (
                  <div className="ml-5 pl-3 border-l border-white/8 flex items-center gap-2 flex-wrap">
                    <label className="text-xs opacity-30" title="Auto-iterate if score is below this threshold">Threshold</label>
                    <input type="number" min="0" max="100" value={agent.iterateThreshold}
                      onChange={e => updateAgent(agent.id, { iterateThreshold: parseInt(e.target.value) || 75 })}
                      className="w-14 text-xs text-center bg-white/5 border border-white/8 rounded px-2 py-0.5 text-white/80 outline-none tabular-nums" />
                    <span className="text-xs opacity-20">/100</span>
                    <label className="text-xs opacity-30" title="Maximum number of improvement rounds">Max rounds</label>
                    <input type="number" min="1" max="10" value={agent.iterateMaxRounds}
                      onChange={e => updateAgent(agent.id, { iterateMaxRounds: parseInt(e.target.value) || 3 })}
                      className="w-10 text-xs text-center bg-white/5 border border-white/8 rounded px-2 py-0.5 text-white/80 outline-none tabular-nums" />
                  </div>
                )}
              </div>

              {/* Agent type */}
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-xs opacity-30">Type</label>
                <select value={agent.agentType}
                  onChange={e => updateAgent(agent.id, { agentType: e.target.value as 'worker' | 'quartermaster' })}
                  className="text-xs bg-white/5 border border-white/8 rounded px-2 py-0.5 text-white/80 outline-none">
                  <option value="worker">Worker</option>
                  <option value="quartermaster">⚓ Quartermaster</option>
                </select>
                {agent.agentType === 'worker' && (
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input type="checkbox" checked={agent.injectRoadmap}
                      onChange={e => updateAgent(agent.id, { injectRoadmap: e.target.checked })}
                      className="accent-violet-500" />
                    <span className="text-xs opacity-40">Inject roadmap</span>
                  </label>
                )}
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
