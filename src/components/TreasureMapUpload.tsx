'use client'

import { useState, useRef, useEffect } from 'react'
import { PT } from './PirateTerm'
import { usePirateClass, usePirateText } from '@/hooks/usePirateMode'

type Tab = 'paste' | 'upload' | 'path'

interface TreasureMapUploadProps {
  onSubmit: (content: string, repos: string[]) => void
  loading?: boolean
}

export function TreasureMapUpload({ onSubmit, loading }: TreasureMapUploadProps) {
  const pirateFont = usePirateClass()
  const t = usePirateText()
  const [tab, setTab] = useState<Tab>('paste')
  const [content, setContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [filePath, setFilePath] = useState('')
  const [repoPaths, setRepoPaths] = useState<string[]>([''])
  const [dragOver, setDragOver] = useState(false)
  const [autoDetected, setAutoDetected] = useState(false)

  // Auto-detect repos from vault's Repository_Map
  useEffect(() => {
    fetch('/api/vault?note=Repository_Map')
      .then(r => r.json())
      .then((data: { exists?: boolean; content?: string }) => {
        if (!data.exists || !data.content) return
        // Extract local paths from the vault's repo map
        const pathRegex = /\*\*(?:Local )?Path\*\*\s*\|\s*`([^`]+)`/gi
        const found: string[] = []
        let match: RegExpExecArray | null
        while ((match = pathRegex.exec(data.content)) !== null) {
          if (match[1]) found.push(match[1])
        }
        if (found.length > 0) {
          setRepoPaths(found)
          setAutoDetected(true)
        }
      })
      .catch((e: unknown) => console.warn('Vault auto-detect failed:', e instanceof Error ? e.message : String(e)))
  }, [])
  const fileRef = useRef<HTMLInputElement>(null)

  const charCount = content.length

  const handleFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text === 'string') setContent(text)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleSubmit = () => {
    if (!content.trim()) return
    const repos = repoPaths.map(r => r.trim()).filter(Boolean)
    onSubmit(content, repos)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'paste', label: 'Paste' },
    { key: 'upload', label: 'Upload' },
    { key: 'path', label: 'File Path' },
  ]

  return (
    <div className="space-y-4">
      {/* Tab selector */}
      <div className="flex gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 text-xs py-1.5 rounded transition-all ${tab === t.key ? 'bg-amber/20 text-amber' : 'text-white/30 hover:text-white/60'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Paste tab */}
      {tab === 'paste' && (
        <div className="relative">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={t('Paste yer treasure map here, Captain... (markdown, text, or any format)', 'Paste your project roadmap here... (markdown, text, or any format)')}
            className="w-full h-64 p-4 text-sm font-mono leading-relaxed bg-parchment/30 border border-white/[0.08] rounded-lg text-white/80 outline-none resize-none placeholder:text-white/15"
            spellCheck={false}
          />
          <span className="absolute bottom-2 right-3 text-xs text-white/15 tabular-nums">{charCount}</span>
        </div>
      )}

      {/* Upload tab */}
      {tab === 'upload' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`h-64 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
            dragOver ? 'border-amber/50 bg-amber/5' : 'border-white/10 bg-parchment/20 hover:border-white/20'
          }`}
        >
          <input ref={fileRef} type="file" accept=".md,.txt,.pdf" className="hidden" onChange={e => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }} />
          {fileName ? (
            <>
              <span className="text-2xl">🗺️</span>
              <span className={`text-sm text-amber ${pirateFont}`}>{fileName}</span>
              <span className="text-xs text-white/30">{charCount} characters loaded</span>
              <button onClick={e => { e.stopPropagation(); setFileName(''); setContent('') }}
                className="text-xs text-white/20 hover:text-white/50 transition-colors">Clear</button>
            </>
          ) : (
            <>
              <span className="text-3xl opacity-20">🗺️</span>
              <span className="text-sm text-white/30">{t('Drop yer treasure map here', 'Drop your roadmap here')}</span>
              <span className="text-xs text-white/15">.md, .txt, .pdf</span>
            </>
          )}
        </div>
      )}

      {/* File path tab */}
      {tab === 'path' && (
        <div className="space-y-3">
          <input
            value={filePath}
            onChange={e => setFilePath(e.target.value)}
            placeholder="C:\path\to\roadmap.md"
            className="w-full input-field font-mono"
          />
          <p className="text-xs text-white/20">This file will be read by the server during analysis.</p>
          <button
            onClick={async () => {
              if (!filePath.trim()) return
              try {
                const res = await fetch('/api/read-file?' + new URLSearchParams({ path: filePath }))
                const data = await res.json() as { content?: string; exists?: boolean; error?: string }
                if (data.content) {
                  setContent(data.content)
                  setTab('paste')
                } else if (data.error) {
                  alert(data.error)
                }
              } catch {
                alert('Failed to read file')
              }
            }}
            className="btn-primary"
          >
            Load File
          </button>
        </div>
      )}

      {/* Repo paths input */}
      <div className="space-y-1.5">
        <label className="text-xs text-white/40 flex items-center gap-1.5">
          {t('Where does yer crew work?', 'Where do your projects live?')}
          {autoDetected && <span className="text-emerald-400/50">(auto-detected from vault)</span>}
        </label>
        <div className="space-y-1">
          {repoPaths.map((rp, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                value={rp}
                onChange={e => setRepoPaths(prev => prev.map((p, j) => j === i ? e.target.value : p))}
                placeholder="C:\Users\you\project-repo"
                className="flex-1 input-field font-mono text-sm"
              />
              {repoPaths.length > 1 && (
                <button onClick={() => setRepoPaths(prev => prev.filter((_, j) => j !== i))}
                  className="text-xs text-white/15 hover:text-red-400 transition-colors px-1">✕</button>
              )}
            </div>
          ))}
          <button onClick={() => setRepoPaths(prev => [...prev, ''])}
            className="text-xs text-white/20 hover:text-white/40 transition-colors">
            + add repo
          </button>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!content.trim() || loading}
        className={`w-full py-3 rounded-lg ${pirateFont} text-lg text-amber border border-amber/30 bg-amber/5 hover:bg-amber/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all`}
      >
        {loading ? t('Charting the course...', 'Analyzing...') : <PT k="Chart the Course" className="border-0" />}
      </button>
    </div>
  )
}
