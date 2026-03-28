'use client'

import { useState, useRef } from 'react'
import { useStore, type Agent } from '@/lib/store'
import { formatTime } from '@/lib/utils'
import { StreamingTerminal } from './StreamingTerminal'
import { DiffViewer } from './DiffViewer'
import { PreviewPanel } from './PreviewPanel'
import { StatusDot, ScoreBadge, GitBadge, STATUS_OPTIONS } from './atoms'
import { Select } from './Select'
import { PT } from './PirateTerm'
import { usePirateClass } from '@/hooks/usePirateMode'

export function AgentCard({ agent }: { agent: Agent }) {
  const pirateFont = usePirateClass()
  const { updateAgent, removeAgent, expandedId, setExpanded } = useStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tab, setTab] = useState<'control' | 'terminal' | 'diff' | 'preview'>('control')
  const [showConfig, setShowConfig] = useState(false)
  const hasBeenExpanded = useRef(false)

  const handleKill = async () => {
    await fetch('/api/kill', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id }),
    }).catch((e: unknown) => console.warn('Kill request failed:', e instanceof Error ? e.message : String(e)))
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
      } catch (e: unknown) { console.warn('Worktree cleanup failed:', e instanceof Error ? e.message : String(e)) }
    }
    // Clean up session file on disk
    fetch('/api/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id }),
    }).catch((e: unknown) => console.warn('Session cleanup failed:', e instanceof Error ? e.message : String(e)))
    // Clean up screenshot files
    fetch('/api/screenshot', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id }),
    }).catch((e: unknown) => console.warn('Screenshot cleanup failed:', e instanceof Error ? e.message : String(e)))
    removeAgent(agent.id)
  }

  const isExpanded = expandedId === agent.id
  if (isExpanded) hasBeenExpanded.current = true
  const highlight = agent.status === 'needs-input' || (agent.plan && agent.planApproved === null)

  return (
    <div className="rounded-lg border transition-all duration-200 overflow-hidden" style={{
      borderColor: highlight ? '#f59e0b' : 'rgba(255,255,255,0.06)',
      backgroundColor: highlight ? 'rgba(245,158,11,0.03)' : isExpanded ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.02)',
      boxShadow: highlight ? '0 0 0 1px rgba(245,158,11,0.12)' : isExpanded ? '0 4px 24px rgba(0,0,0,0.3)' : 'none',
      borderLeftWidth: '3px',
      borderLeftColor: agent.color,
    }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-white/[0.02] transition-colors duration-150" onClick={() => setExpanded(isExpanded ? null : agent.id)}>
        <span className="text-lg flex-shrink-0">{agent.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm ${pirateFont}`} style={{ color: agent.color }}>{agent.name}</span>
            <span className="text-xs opacity-25">{agent.role}</span>
            <StatusDot status={agent.status} />
            <ScoreBadge score={agent.score} />
            {agent.plan && agent.planApproved === null && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">PLAN</span>}
            {agent.sessionId && <span className="text-xs px-1 py-0.5 rounded bg-green-500/10 text-green-500/60">live</span>}
            {agent.worktreeBranch && <span className="text-xs px-1 py-0.5 rounded bg-purple-500/10 text-purple-400/60 font-mono">{agent.worktreeBranch}</span>}
            {agent.agentType === 'quartermaster' && <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400/80">⚓ QM</span>}
            {agent.budgetCap != null && agent.sessionCost >= agent.budgetCap && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium animate-pulse">🚫 stopped</span>
            )}
            {agent.budgetCap != null && agent.sessionCost > 0 && agent.sessionCost < agent.budgetCap && agent.sessionCost >= agent.budgetCap * 0.8 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400/80 font-mono tabular-nums">
                ${agent.sessionCost.toFixed(2)}/${agent.budgetCap.toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs opacity-35 truncate">{agent.task || 'No active task'}</span>
            <GitBadge git={agent.git} />
            {!agent.path && <span className="text-xs text-red-400/60">no repo</span>}
            {agent.path && !agent.git && <span className="text-xs font-mono opacity-15 truncate max-w-[120px]" title={agent.path}>{agent.path.replace(/\\/g, '/').split('/').pop()}</span>}
            {agent.lastUpdate && <span className="text-xs opacity-20">{formatTime(agent.lastUpdate)}</span>}
            {agent.sessionCost > 0 && (
              <span className="text-xs tabular-nums font-mono text-white/25 flex-shrink-0">${agent.sessionCost.toFixed(4)}</span>
            )}
          </div>
        </div>
        <span className={`text-xs text-white/20 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
      </div>

      {/* Expandable content with CSS grid animation */}
      <div className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          {hasBeenExpanded.current && (
            <>
              {/* Tab bar */}
              <div className="flex items-center gap-1 px-4 py-1 border-t border-white/[0.06] overflow-x-auto">
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
                  {agent.status === 'running' && (
                    <button onClick={handleKill}
                      className="text-xs px-2 py-1 text-red-400/50 hover:text-red-400 transition-all"
                      title="Kill the running claude process">
                      ✕ <PT k="Scuttle" className="border-0" />
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
                  {/* Status buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {STATUS_OPTIONS.map(s => (
                      <button key={s.value} onClick={() => updateAgent(agent.id, { status: s.value, lastUpdate: Date.now() })}
                        className="text-xs px-2 py-1 rounded transition-all" style={{
                          backgroundColor: agent.status === s.value ? s.color + '33' : 'rgba(255,255,255,0.03)',
                          color: agent.status === s.value ? s.color : '#555',
                          border: agent.status === s.value ? `1px solid ${s.color}44` : '1px solid transparent',
                        }}><PT k={s.pirateLabel} className="border-0" /></button>
                    ))}
                  </div>

                  {/* Task */}
                  <div>
                    <label className="field-label">Task</label>
                    <input type="text" value={agent.task} onChange={e => updateAgent(agent.id, { task: e.target.value, lastUpdate: Date.now() })}
                      placeholder="What is this agent working on?"
                      className="w-full input-field" />
                  </div>

                  {/* Plan */}
                  <div>
                    <label className="field-label">Plan</label>
                    <textarea value={agent.plan} onChange={e => updateAgent(agent.id, { plan: e.target.value })}
                      placeholder="Paste agent's plan..." rows={3}
                      className="w-full input-field resize-y font-mono leading-relaxed" />
                    {agent.plan && (
                      <div className="flex items-center gap-2 mt-1.5">
                        {agent.planApproved === null && <>
                          <button onClick={() => updateAgent(agent.id, { planApproved: true, status: 'running', lastUpdate: Date.now() })}
                            className="text-xs px-3 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors">✓ Approve & Run</button>
                          <button onClick={() => updateAgent(agent.id, { planApproved: false, status: 'needs-input', lastUpdate: Date.now() })}
                            className="text-xs px-3 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors">✗ Reject</button>
                        </>}
                        {agent.planApproved === true && <span className="text-xs text-emerald-400">✓ Approved <button onClick={() => updateAgent(agent.id, { planApproved: null })} className="opacity-50 hover:opacity-100 ml-1">(reset)</button></span>}
                        {agent.planApproved === false && <span className="text-xs text-red-400">✗ Rejected <button onClick={() => updateAgent(agent.id, { planApproved: null })} className="opacity-50 hover:opacity-100 ml-1">(reset)</button></span>}
                      </div>
                    )}
                  </div>

                  {/* Collapsible Configuration section */}
                  <button onClick={() => setShowConfig(c => !c)}
                    className="text-xs text-white/25 hover:text-white/50 transition-colors flex items-center gap-1.5">
                    <span className={`transition-transform duration-150 text-[10px] ${showConfig ? 'rotate-90' : ''}`}>&#x25B6;</span>
                    Configuration
                  </button>
                  <div className="grid transition-[grid-template-rows] duration-200 ease-out"
                    style={{ gridTemplateRows: showConfig ? '1fr' : '0fr' }}>
                    <div className="overflow-hidden">
                      <div className="space-y-3 pt-1">
                        {/* Score */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <label className="field-label mb-0"><PT k="Plunder Rating" className="border-0" /></label>
                          <input type="number" min="0" max="100" value={agent.score ?? ''}
                            onChange={e => updateAgent(agent.id, { score: e.target.value ? parseInt(e.target.value) : null, lastUpdate: Date.now() })}
                            className="w-16 input-field-sm text-center tabular-nums" />
                          <span className="text-xs opacity-20">/ 100</span>
                        </div>

                        {/* Budget cap */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <label className="field-label mb-0"><PT k="Treasure Chest" className="border-0" /></label>
                          <span className="text-xs opacity-30">$</span>
                          <input type="number" min="0" step="0.1" value={agent.budgetCap ?? ''}
                            placeholder="none"
                            onChange={e => updateAgent(agent.id, { budgetCap: e.target.value ? parseFloat(e.target.value) : null })}
                            className="w-20 input-field-sm text-center tabular-nums" />
                          <span className="text-xs opacity-20">USD / session</span>
                          {agent.sessionCost > 0 && (
                            <span className={`text-xs tabular-nums font-mono ${agent.budgetCap != null && agent.sessionCost >= agent.budgetCap ? 'text-red-400' : agent.budgetCap != null && agent.sessionCost >= agent.budgetCap * 0.8 ? 'text-amber-400' : 'text-white/25'}`}>
                              ${agent.sessionCost.toFixed(4)} used
                            </span>
                          )}
                        </div>

                        {/* Auto-iterate */}
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input type="checkbox" checked={agent.autoIterate}
                              onChange={e => updateAgent(agent.id, { autoIterate: e.target.checked })}
                              className="accent-amber-500" />
                            <span className="text-xs opacity-40"><PT k="Keep Sailing" className="border-0" /></span>
                            <span className="text-xs opacity-20 cursor-help" title="After each task, Fleet auto-rates the output and iterates until the score meets the threshold or max rounds is reached">(?)</span>
                          </label>
                          {agent.autoIterate && (
                            <div className="ml-5 pl-3 border-l border-white/[0.08] flex items-center gap-2 flex-wrap">
                              <label className="text-xs opacity-30" title="Auto-iterate if score is below this threshold">Threshold</label>
                              <input type="number" min="0" max="100" value={agent.iterateThreshold}
                                onChange={e => updateAgent(agent.id, { iterateThreshold: parseInt(e.target.value) || 75 })}
                                className="w-14 input-field-sm text-center tabular-nums" />
                              <span className="text-xs opacity-20">/100</span>
                              <label className="text-xs opacity-30" title="Maximum number of improvement rounds">Max rounds</label>
                              <input type="number" min="1" max="10" value={agent.iterateMaxRounds}
                                onChange={e => updateAgent(agent.id, { iterateMaxRounds: parseInt(e.target.value) || 3 })}
                                className="w-10 input-field-sm text-center tabular-nums" />
                            </div>
                          )}
                        </div>

                        {/* Agent type */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <label className="field-label mb-0">Type</label>
                          <Select value={agent.agentType} size="sm"
                            onChange={v => updateAgent(agent.id, { agentType: v as 'worker' | 'quartermaster' })}
                            options={[
                              { value: 'worker', label: '⚙️ Worker' },
                              { value: 'quartermaster', label: '⚓ Quartermaster' },
                            ]} className="w-36" />
                          {agent.agentType === 'worker' && (
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input type="checkbox" checked={agent.injectRoadmap}
                                onChange={e => updateAgent(agent.id, { injectRoadmap: e.target.checked })}
                                className="accent-violet-500" />
                              <span className="text-xs opacity-40">Inject <PT k="Treasure Map" className="border-0" /></span>
                            </label>
                          )}
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input type="checkbox" checked={agent.injectVault}
                              onChange={e => updateAgent(agent.id, { injectVault: e.target.checked })}
                              className="accent-emerald-500" />
                            <span className="text-xs opacity-40">Inject Vault</span>
                          </label>
                        </div>

                        {/* Notes */}
                        <div>
                          <label className="field-label">Notes</label>
                          <textarea value={agent.notes} onChange={e => updateAgent(agent.id, { notes: e.target.value })}
                            placeholder="Blockers, observations..." rows={2}
                            className="w-full input-field resize-y" />
                        </div>

                        {agent.git && (
                          <div className="text-xs space-y-1 opacity-40">
                            <div>Last commit: <span className="text-white/60">{agent.git.lastCommit}</span></div>
                            <div className="font-mono opacity-60">{agent.path}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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
      </div>
    </div>
  )
}
