'use client'

import { useState, useRef } from 'react'
import type { Agent } from '@/lib/store'

export function PreviewPanel({ agent }: { agent: Agent }) {
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
