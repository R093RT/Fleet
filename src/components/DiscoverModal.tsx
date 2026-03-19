'use client'

import { useState, useEffect, useCallback } from 'react'
import { useStore } from '@/lib/store'
import type { DiscoveredProcess } from '@/app/api/discover/route'

// Browser-safe path.basename replacement
const basename = (p: string) => p.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? p

export function DiscoverModal({ onClose }: { onClose: () => void }) {
  const { agents, updateAgent, addAgent } = useStore()
  const [processes, setProcesses] = useState<DiscoveredProcess[]>([])
  const [loading, setLoading] = useState(true)

  const scan = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/discover')
      const data = await res.json()
      setProcesses(data.processes ?? [])
    } catch {
      setProcesses([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { void scan() }, [scan])

  const matchAgent = (cwd: string) =>
    agents.find(a => a.path === cwd || a.worktreePath === cwd) ?? null

  // A process is already linked if the matched agent already has this sessionId
  const isAlreadyLinked = (proc: DiscoveredProcess) => {
    const agent = matchAgent(proc.cwd)
    return agent != null && proc.sessionId != null && agent.sessionId === proc.sessionId
  }

  const handleLink = (proc: DiscoveredProcess, agentId: string) => {
    updateAgent(agentId, {
      sessionId: proc.sessionId,
      status: 'running',
      lastUpdate: Date.now(),
    })
    // Re-scan so the row immediately reflects the new linked state
    void scan()
  }

  const handleAdopt = (proc: DiscoveredProcess) => {
    const name = basename(proc.cwd)
    addAgent({
      name,
      repo: name,
      path: proc.cwd,
      sessionId: proc.sessionId,
      status: 'running',
      lastUpdate: Date.now(),
    })
    // Re-scan so the new agent is reflected in matching logic
    void scan()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-raised border border-white/10 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Running Claude Processes</span>
            {!loading && <span className="text-xs opacity-30">{processes.length} found</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={scan} disabled={loading}
              className="text-xs px-3 py-1 rounded bg-white/5 text-white/50 hover:text-white/90 border border-white/8 disabled:opacity-30 transition-all">
              {loading ? 'Scanning...' : '↻ Refresh'}
            </button>
            <button onClick={onClose} className="text-xs opacity-30 hover:opacity-100 px-2 py-1">ESC</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="text-center py-12 text-xs opacity-30 animate-pulse">Scanning for claude processes...</div>
          )}

          {!loading && processes.length === 0 && (
            <div className="text-center py-12 text-xs opacity-20">
              No untracked claude processes found.
              <div className="mt-1 opacity-70">Start a claude agent outside Fleet and scan again.</div>
            </div>
          )}

          {processes.map(proc => {
            const matchedAgent = matchAgent(proc.cwd)
            const alreadyLinked = isAlreadyLinked(proc)

            return (
              <div key={proc.pid}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-white/6 bg-white/[0.02]">
                <span className="text-lg flex-shrink-0">⚙️</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono text-white/80 truncate">{basename(proc.cwd)}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/30 font-mono">PID {proc.pid}</span>
                    {proc.sessionId && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-500/60 font-mono">
                        {proc.sessionId.slice(0, 12)}…
                      </span>
                    )}
                    {alreadyLinked && matchedAgent && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/60">
                        linked to {matchedAgent.name}
                      </span>
                    )}
                    {!alreadyLinked && matchedAgent && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400/60">
                        matches {matchedAgent.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs opacity-25 font-mono truncate">{proc.cwd}</span>
                  </div>
                  {proc.promptSnippet && (
                    <div className="text-xs opacity-35 italic mt-0.5 truncate">&ldquo;{proc.promptSnippet}&rdquo;</div>
                  )}
                </div>

                <div className="flex-shrink-0">
                  {alreadyLinked ? (
                    <span className="text-xs text-emerald-400/60">✓ Linked</span>
                  ) : matchedAgent ? (
                    <button onClick={() => handleLink(proc, matchedAgent.id)}
                      className="text-xs px-3 py-1.5 rounded transition-all whitespace-nowrap"
                      style={{ backgroundColor: 'rgba(212,168,67,0.12)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.2)' }}>
                      Link to {matchedAgent.name}
                    </button>
                  ) : (
                    <button onClick={() => handleAdopt(proc)}
                      className="text-xs px-3 py-1.5 rounded bg-white/5 text-white/60 hover:text-white/90 border border-white/10 transition-all">
                      Adopt
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-5 py-2 border-t border-white/5 text-xs opacity-15">
          Adopted agents link to their session ID. Live output of the current run remains in the original terminal.
        </div>
      </div>
    </div>
  )
}
