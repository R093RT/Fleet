'use client'

import { useState } from 'react'
import type { Agent } from '@/lib/store'

type DiffMode = 'staged' | 'unstaged' | 'last-commit' | 'unpushed'

export function DiffViewer({ agent }: { agent: Agent }) {
  const [mode, setMode] = useState<DiffMode>('unstaged')
  const [diff, setDiff] = useState('')
  const [summary, setSummary] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadDiff = async (m: DiffMode) => {
    setMode(m)
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoPath: agent.path, mode: m }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDiff(data.diff || '')
      setSummary(data.summary || '')
      setFiles(data.files || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-white/5">
      {/* Mode selector */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5">
        {([
          { value: 'unstaged' as DiffMode, label: 'Working' },
          { value: 'staged' as DiffMode, label: 'Staged' },
          { value: 'last-commit' as DiffMode, label: 'Last Commit' },
          { value: 'unpushed' as DiffMode, label: 'Unpushed' },
        ]).map(m => (
          <button key={m.value} onClick={() => loadDiff(m.value)}
            className="text-xs px-2 py-1 rounded transition-all"
            style={{
              backgroundColor: mode === m.value && diff ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
              color: mode === m.value && diff ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
            }}>
            {m.label}
          </button>
        ))}
        <button onClick={() => loadDiff(mode)} className="text-xs text-white/20 hover:text-white/60 ml-auto transition-all">
          ↻ Refresh
        </button>
      </div>

      {/* Content */}
      <div className="h-72 overflow-auto bg-black/30">
        {loading && <div className="text-xs opacity-20 text-center py-12">Loading diff...</div>}
        {error && <div className="text-xs text-red-400 text-center py-12">{error}</div>}
        {!loading && !error && !diff && (
          <div className="text-xs opacity-15 text-center py-12">Click a mode above to load the diff</div>
        )}

        {!loading && diff && (
          <div className="p-3 space-y-2">
            {/* Summary */}
            {summary && (
              <div className="text-xs opacity-40 pb-2 border-b border-white/5 whitespace-pre font-mono">{summary}</div>
            )}

            {/* Changed files list */}
            {files.length > 0 && (
              <div className="text-xs opacity-30 pb-2">
                {files.length} file{files.length !== 1 ? 's' : ''} changed
              </div>
            )}

            {/* Diff output with line coloring */}
            <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all">
              {diff.split('\n').map((line, i) => {
                let color = 'rgba(255,255,255,0.5)'
                let bg = 'transparent'
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  color = '#4ade80'
                  bg = 'rgba(74,222,128,0.06)'
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                  color = '#f87171'
                  bg = 'rgba(248,113,113,0.06)'
                } else if (line.startsWith('@@')) {
                  color = '#60a5fa'
                  bg = 'rgba(96,165,250,0.04)'
                } else if (line.startsWith('diff ') || line.startsWith('index ')) {
                  color = 'rgba(255,255,255,0.25)'
                }
                return (
                  <div key={i} style={{ color, backgroundColor: bg }} className="px-1 -mx-1">
                    {line}
                  </div>
                )
              })}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
