'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/lib/toast-store'

export function NotepadPanel({ agentId }: { agentId: string }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { success: toastSuccess, error: toastError } = useToast()

  const loadNotepad = useCallback(async () => {
    try {
      const res = await fetch(`/api/notepad?agentId=${encodeURIComponent(agentId)}`)
      const data = await res.json()
      setContent(data.content ?? '')
    } catch (e: unknown) {
      console.warn('Failed to load notepad:', e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    void loadNotepad()
  }, [loadNotepad])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/notepad', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, content }),
      })
      if (res.ok) {
        toastSuccess('Notepad saved')
      } else {
        toastError('Failed to save notepad')
      }
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="px-4 py-8 text-center text-xs opacity-30">Loading notepad...</div>
  }

  return (
    <div className="px-4 pb-4 pt-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs opacity-40">Per-agent persistent memory. Injected on session start when enabled.</span>
        <button onClick={handleSave} disabled={saving}
          className="text-xs px-3 py-1 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors disabled:opacity-30">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="## Priority Context\nCritical info always injected...\n\n## Working Memory\nSession notes, learnings..."
        rows={12}
        className="w-full input-field resize-y font-mono text-xs leading-relaxed"
      />
    </div>
  )
}
