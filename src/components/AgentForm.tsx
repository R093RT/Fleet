'use client'

import { useState } from 'react'

const ICONS = ['⚙️','📍','🌿','📣','🧠','🔧','🚀','📊','🎨','🔬','📦','🛡️','💾','🌐','📱']
const COLORS = ['#2563eb','#3b82f6','#059669','#0d9488','#d97706','#7c3aed','#e11d48','#06b6d4','#84cc16','#f97316','#8b5cf6','#ec4899']

export interface AgentFormValues {
  name: string
  role: string
  path: string
  icon: string
  color: string
  devPort: string
}

interface AgentFormProps {
  initial?: AgentFormValues
  submitLabel: string
  onSubmit: (v: AgentFormValues) => void
  onCancel?: () => void
}

export function AgentForm({ initial, submitLabel, onSubmit, onCancel }: AgentFormProps) {
  const [name, setName] = useState(initial?.name || '')
  const [role, setRole] = useState(initial?.role || '')
  const [path, setPath] = useState(initial?.path || '')
  const [icon, setIcon] = useState(initial?.icon || '⚙️')
  const [color, setColor] = useState(initial?.color || '#2563eb')
  const [devPort, setDevPort] = useState(initial?.devPort || '')

  const isValid = name.trim() && path.trim()

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs opacity-30 block mb-1">Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Frontend" autoFocus
            className="w-full text-sm bg-white/5 border border-white/8 rounded px-3 py-1.5 text-white/90 placeholder:text-white/15 outline-none focus:border-white/20" />
        </div>
        <div className="flex-1">
          <label className="text-xs opacity-30 block mb-1">Role</label>
          <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. UI Components"
            className="w-full text-sm bg-white/5 border border-white/8 rounded px-3 py-1.5 text-white/90 placeholder:text-white/15 outline-none focus:border-white/20" />
        </div>
      </div>
      <div>
        <label className="text-xs opacity-30 block mb-1">Path to repo *</label>
        <input value={path} onChange={e => setPath(e.target.value)}
          placeholder="/Users/you/my-project  or  C:\Users\you\my-project"
          className="w-full text-sm bg-white/5 border border-white/8 rounded px-3 py-1.5 text-white/90 placeholder:text-white/15 outline-none font-mono focus:border-white/20" />
      </div>
      <div>
        <label className="text-xs opacity-30 block mb-1">Dev port <span className="opacity-50">(optional)</span></label>
        <input value={devPort} onChange={e => setDevPort(e.target.value.replace(/\D/g, ''))} placeholder="3000"
          className="w-24 text-sm bg-white/5 border border-white/8 rounded px-3 py-1.5 text-white/90 placeholder:text-white/15 outline-none tabular-nums" />
      </div>
      <div>
        <label className="text-xs opacity-30 block mb-1">Icon</label>
        <div className="flex gap-1 flex-wrap">
          {ICONS.map(i => <button key={i} onClick={() => setIcon(i)} className="w-8 h-8 rounded flex items-center justify-center text-base transition-all"
            style={{ backgroundColor: icon === i ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)', border: icon === i ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent' }}>{i}</button>)}
        </div>
      </div>
      <div>
        <label className="text-xs opacity-30 block mb-1">Color</label>
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map(c => <button key={c} onClick={() => setColor(c)} className="w-6 h-6 rounded-full transition-all"
            style={{ backgroundColor: c, border: color === c ? '2px solid white' : '2px solid transparent', transform: color === c ? 'scale(1.15)' : '' }} />)}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && <button onClick={onCancel} className="text-xs px-3 py-1.5 text-white/30 hover:text-white/80">Cancel</button>}
        <button onClick={() => isValid && onSubmit({ name, role, path, icon, color, devPort })} disabled={!isValid}
          className="text-xs px-4 py-1.5 rounded font-medium disabled:opacity-20 transition-all"
          style={{ backgroundColor: 'rgba(212,168,67,0.2)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.3)' }}>
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
