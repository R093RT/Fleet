'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'

export function RoadmapModal({ onClose }: { onClose: () => void }) {
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
