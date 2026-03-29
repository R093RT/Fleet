'use client'

import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { PT } from './PirateTerm'
import { usePirateClass } from '@/hooks/usePirateMode'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export function RoadmapModal({ onClose }: { onClose: () => void }) {
  const { roadmap, setRoadmap } = useStore()
  const pirateFont = usePirateClass()
  const trapRef = useFocusTrap<HTMLDivElement>()
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
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title-roadmap">
      <div ref={trapRef} className="modal-content w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <span>🗺️</span>
            <span id="modal-title-roadmap" className={`text-sm ${pirateFont} text-amber`}><PT k="Treasure Map" /></span>
          </div>
          <div className="flex items-center gap-2">
            {saveMsg && <span className="text-xs opacity-50">{saveMsg}</span>}
            <button onClick={save} disabled={saving}
              className="btn-primary">
              {saving ? 'Saving...' : 'Save to disk'}
            </button>
            <button onClick={onClose} className="text-xs opacity-30 hover:opacity-100 transition-opacity px-2 py-1">ESC</button>
          </div>
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)}
          className="flex-1 p-5 text-sm font-mono leading-relaxed bg-transparent text-white/80 outline-none resize-none"
          spellCheck={false} placeholder={loaded ? 'Set ROADMAP_PATH in .env to link a file...' : 'Loading...'} />
        <div className="px-5 py-2 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-xs opacity-20">Set <code className="font-mono">ROADMAP_PATH</code> in .env to link a file on disk</span>
          <span className="text-xs opacity-25">
            💡 Tip: point <code className="font-mono">ROADMAP_PATH</code> to a file inside an{' '}
            <a href="https://obsidian.md" target="_blank" rel="noreferrer" className="underline hover:opacity-60 transition-all">Obsidian</a>{' '}
            vault — your <PT k="Quartermaster" /> writes it, you visualize the graph
          </span>
        </div>
      </div>
    </div>
  )
}
