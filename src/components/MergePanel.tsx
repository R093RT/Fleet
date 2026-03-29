'use client'

import { useState } from 'react'
import type { Agent } from '@/lib/store'
import { useToast } from '@/lib/toast-store'
import { PT } from './PirateTerm'

type MergeState = 'idle' | 'checking' | 'ready' | 'merging'

export function MergePanel({ agent }: { agent: Agent }) {
  const [state, setState] = useState<MergeState>('idle')
  const [dryRunResult, setDryRunResult] = useState<{ conflicts: boolean; diff?: string; message?: string } | null>(null)
  const [error, setError] = useState('')
  const { success, error: toastError } = useToast()

  if (!agent.worktreeBranch) return null

  const targetBranch = 'main'

  const doDryRun = async () => {
    setState('checking')
    setError('')
    setDryRunResult(null)
    try {
      const res = await fetch('/api/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath: agent.path,
          sourceBranch: agent.worktreeBranch,
          targetBranch,
          mode: 'dry-run',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Merge check failed')
      setDryRunResult(data)
      setState('ready')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setState('idle')
    }
  }

  const doMerge = async () => {
    setState('merging')
    setError('')
    try {
      const res = await fetch('/api/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath: agent.path,
          sourceBranch: agent.worktreeBranch,
          targetBranch,
          mode: 'merge',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Merge failed')
      success(`Merged ${agent.worktreeBranch} → ${targetBranch}`)
      setState('idle')
      setDryRunResult(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toastError(`Merge failed: ${msg}`)
      setState('idle')
    }
  }

  return (
    <div className="border-t border-white/5 px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/40">
          <PT k="Dock &amp; Merge" className="border-0" /> <span className="opacity-60 font-mono">{agent.worktreeBranch}</span> → <span className="font-mono opacity-60">{targetBranch}</span>
        </span>
        {state === 'idle' && (
          <button onClick={doDryRun} className="text-xs px-2 py-1 rounded bg-white/5 text-white/40 hover:text-white/70 border border-white/8 transition-all">
            Check
          </button>
        )}
      </div>

      {state === 'checking' && (
        <div className="text-xs text-white/30 animate-pulse py-2">Checking for conflicts...</div>
      )}

      {error && (
        <div className="text-xs text-red-400/70 py-1">{error}</div>
      )}

      {dryRunResult && state === 'ready' && (
        <div className="space-y-2">
          {dryRunResult.conflicts ? (
            <div className="text-xs text-amber-400/70 bg-amber-500/5 rounded p-2 border border-amber-500/10">
              Conflicts detected — resolve manually before merging.
              {dryRunResult.message && <pre className="mt-1 text-white/30 whitespace-pre-wrap text-[10px]">{dryRunResult.message.slice(0, 500)}</pre>}
            </div>
          ) : (
            <>
              {dryRunResult.diff && (
                <pre className="text-[10px] font-mono text-white/40 bg-black/20 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">{dryRunResult.diff}</pre>
              )}
              <div className="flex items-center gap-2">
                <button onClick={doMerge} className="text-xs px-3 py-1 rounded bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-all">
                  Merge
                </button>
                <button onClick={() => { setState('idle'); setDryRunResult(null) }} className="text-xs px-2 py-1 rounded text-white/30 hover:text-white/50 transition-all">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {state === 'merging' && (
        <div className="text-xs text-green-400/60 animate-pulse py-2">Merging...</div>
      )}
    </div>
  )
}
