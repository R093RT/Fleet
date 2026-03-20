'use client'

import { useState, useRef } from 'react'
import type { Agent } from '@/lib/store'

interface DiffResult {
  beforePath: string
  afterPath: string
  diffPath: string
  diffPixels: number
  totalPixels: number
  diffPercent: number
}

export function PreviewPanel({ agent }: { agent: Agent }) {
  const [port, setPort] = useState(agent.devPort?.toString() || '')
  const [path, setPath] = useState(agent.previewPath || '/')
  const [url, setUrl] = useState(agent.devPort ? `http://localhost:${agent.devPort}${agent.previewPath || '/'}` : '')
  const [key, setKey] = useState(0)
  const [beforePath, setBeforePath] = useState<string | null>(null)
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = () => {
    if (port) {
      setUrl(`http://localhost:${port}${path}`)
      setKey(k => k + 1)
    }
  }

  const captureLabel = async (label: 'before' | 'after') => {
    if (!url) return
    setCapturing(true)
    setCaptureError(null)
    setDiffResult(null)
    try {
      const res = await fetch('/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, url, label }),
      })
      const data = await res.json()

      if (!data.success) {
        setCaptureError(data.note ?? 'Screenshot failed. Is Playwright installed? Run: npx playwright install chromium')
        setCapturing(false)
        return
      }

      if (label === 'before') {
        if (data.path) {
          setBeforePath(data.path as string)
        } else {
          setCaptureError('Playwright not available. Run: npx playwright install chromium')
        }
      } else {
        // after
        if (data.dimensionMismatch) {
          setCaptureError(`Viewport size changed (${data.beforeSize as string} → ${data.afterSize as string}). Re-capture a baseline at the current size.`)
        } else if (data.diffError) {
          setCaptureError(`Diff failed: ${data.diffError as string}`)
        } else if (data.diffPath) {
          setDiffResult(data as DiffResult)
        } else {
          setCaptureError('No baseline found — capture a baseline first.')
        }
      }
    } catch {
      setCaptureError('Network error capturing screenshot.')
    }
    setCapturing(false)
  }

  const diffPctColor = diffResult
    ? diffResult.diffPercent < 5 ? 'text-green-400'
    : diffResult.diffPercent < 20 ? 'text-amber-400'
    : 'text-red-400'
    : ''

  return (
    <div className="border-t border-white/5 bg-black/20">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-xs opacity-30">localhost:</span>
        <input type="text" value={port} onChange={e => setPort(e.target.value.replace(/\D/g, ''))} placeholder="port"
          className="w-14 input-field-sm tabular-nums" />
        <input type="text" value={path} onChange={e => setPath(e.target.value)} placeholder="/"
          className="flex-1 input-field-sm font-mono" />
        <button onClick={load} className="text-xs px-2 py-0.5 rounded bg-white/8 text-white/60 hover:text-white border border-white/10 transition-all">Load</button>
        <button onClick={() => setKey(k => k + 1)} className="text-xs text-white/30 hover:text-white/80" title="Refresh">↻</button>
        <button onClick={() => ref.current?.requestFullscreen?.()} className="text-xs text-white/30 hover:text-white/80" title="Fullscreen">⛶</button>
        {url && (
          <>
            <button
              onClick={() => void captureLabel('before')}
              disabled={capturing}
              title="Capture baseline screenshot for visual diffing"
              className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/40 hover:text-white/70 border border-white/8 disabled:opacity-30 transition-all flex items-center gap-1">
              {capturing && !beforePath ? (
                <span className="inline-block w-2.5 h-2.5 border border-white/40 border-t-white/80 rounded-full animate-spin" />
              ) : (
                '📸'
              )}
              {beforePath ? 'Re-baseline' : 'Baseline'}
            </button>
            {beforePath && (
              <button
                onClick={() => void captureLabel('after')}
                disabled={capturing}
                title="Capture current state and compare to baseline"
                className="text-xs px-2 py-0.5 rounded disabled:opacity-30 transition-all flex items-center gap-1"
                style={{ backgroundColor: 'rgba(212,168,67,0.12)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.2)' }}>
                {capturing && !!beforePath ? (
                  <span className="inline-block w-2.5 h-2.5 border border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
                ) : null}
                Compare
              </button>
            )}
          </>
        )}
      </div>

      {/* Error banner */}
      {captureError && (
        <div className="mx-4 mb-2 px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center justify-between">
          <span>{captureError}</span>
          <button onClick={() => setCaptureError(null)} className="opacity-50 hover:opacity-100 ml-3">✕</button>
        </div>
      )}

      {/* iframe */}
      {url ? (
        <div ref={ref} style={{ height: 450 }} className="relative">
          <iframe key={key} src={url} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
          <div className="absolute bottom-2 right-2 text-xs font-mono opacity-15 bg-black/60 px-1.5 py-0.5 rounded">{url}</div>
          {beforePath && !diffResult && (
            <div className="absolute bottom-2 left-2 text-xs font-mono opacity-30 bg-black/60 px-1.5 py-0.5 rounded">📸 baseline set</div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center text-xs opacity-15 py-20">Enter port + Load</div>
      )}

      {/* Screenshot diff comparison — shown below iframe without collapsing it */}
      {diffResult && (
        <div className="border-t border-white/5">
          <div className="grid grid-cols-3 gap-2 p-3 bg-black/20">
            {[
              { label: 'Before', src: diffResult.beforePath },
              { label: 'After', src: diffResult.afterPath },
              { label: null, src: diffResult.diffPath },
            ].map(({ label, src }) => (
              <div key={src}>
                <div className="text-xs mb-1 flex items-center justify-between">
                  {label === null ? (
                    <span className={`font-medium ${diffPctColor}`}>
                      {diffResult.diffPercent.toFixed(1)}% changed
                    </span>
                  ) : (
                    <span className="opacity-30">{label}</span>
                  )}
                  <a href={src} target="_blank" rel="noreferrer" className="opacity-20 hover:opacity-60 text-xs" title="Open full size">⤢</a>
                </div>
                <a href={src} target="_blank" rel="noreferrer" title="Click to open full size">
                  <img src={src} alt={label ?? 'diff'} className="w-full rounded border border-white/8 object-contain cursor-zoom-in hover:border-white/20 transition-all" style={{ maxHeight: 180 }} />
                </a>
                {label === null && (
                  <div className="text-xs opacity-20 mt-0.5 tabular-nums">{diffResult.diffPixels.toLocaleString()} px</div>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 pb-3">
            <button
              onClick={() => { setBeforePath(diffResult.afterPath); setDiffResult(null) }}
              className="text-xs px-3 py-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all">
              ✓ Approve — promote after as new baseline
            </button>
            <button
              onClick={() => setDiffResult(null)}
              className="text-xs px-2 py-1 text-white/30 hover:text-white/60 transition-all">
              ↩ Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
