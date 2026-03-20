'use client'

import { useState } from 'react'
import { Select } from './Select'

const ICONS = ['⚙️','📍','🌿','📣','🧠','🔧','🚀','📊','🎨','🔬','📦','🛡️','💾','🌐','📱']
const ICON_LABELS: Record<string, string> = {
  '⚙️': 'Gear', '📍': 'Pin', '🌿': 'Branch', '📣': 'Announce', '🧠': 'Brain',
  '🔧': 'Wrench', '🚀': 'Rocket', '📊': 'Chart', '🎨': 'Art', '🔬': 'Science',
  '📦': 'Package', '🛡️': 'Shield', '💾': 'Disk', '🌐': 'Globe', '📱': 'Mobile',
}
const COLORS = ['#2563eb','#3b82f6','#059669','#0d9488','#d97706','#7c3aed','#e11d48','#06b6d4','#84cc16','#f97316','#8b5cf6','#ec4899']

export interface AgentFormValues {
  name: string
  role: string
  path: string
  icon: string
  color: string
  devPort: string
  agentType: 'worker' | 'quartermaster'
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
  const [agentType, setAgentType] = useState<'worker' | 'quartermaster'>(initial?.agentType || 'worker')
  const [touched, setTouched] = useState<Set<string>>(new Set())

  const touch = (field: string) => setTouched(prev => new Set(prev).add(field))
  const isValid = name.trim() && path.trim()

  const handleSubmit = () => {
    touch('name')
    touch('path')
    if (isValid) onSubmit({ name, role, path, icon, color, devPort, agentType })
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="field-label">Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} onBlur={() => touch('name')}
            placeholder="e.g. Frontend" autoFocus
            className="w-full input-field" />
          {touched.has('name') && !name.trim() && (
            <p className="text-xs text-red-400/70 mt-1 animate-fade-in">Agent name is required</p>
          )}
        </div>
        <div className="flex-1">
          <label className="field-label">Role</label>
          <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. UI Components"
            className="w-full input-field" />
        </div>
      </div>
      <div>
        <label className="field-label">Path to repo *</label>
        <input value={path} onChange={e => setPath(e.target.value)} onBlur={() => touch('path')}
          placeholder="/Users/you/my-project  or  C:\Users\you\my-project"
          className="w-full input-field font-mono" />
        {touched.has('path') && !path.trim() && (
          <p className="text-xs text-red-400/70 mt-1 animate-fade-in">Path to a local repo is required</p>
        )}
      </div>
      <div className="flex gap-3 items-end">
        <div>
          <label className="field-label">Dev port <span className="opacity-50">(optional)</span></label>
          <input value={devPort} onChange={e => setDevPort(e.target.value.replace(/\D/g, ''))} placeholder="3000"
            className="w-24 input-field tabular-nums" />
        </div>
        <div>
          <label className="field-label">Type</label>
          <Select value={agentType} onChange={v => setAgentType(v as 'worker' | 'quartermaster')}
            options={[
              { value: 'worker', label: '⚙️ Worker' },
              { value: 'quartermaster', label: '⚓ Quartermaster' },
            ]} className="w-40" />
        </div>
      </div>
      <div>
        <label className="field-label">Icon</label>
        <div className="flex gap-1 flex-wrap">
          {ICONS.map(i => <button key={i} onClick={() => setIcon(i)} title={ICON_LABELS[i] ?? i}
            className="w-8 h-8 rounded flex items-center justify-center text-base transition-all focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-1 focus:ring-offset-surface"
            style={{ backgroundColor: icon === i ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)', border: icon === i ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent' }}>{i}</button>)}
        </div>
      </div>
      <div>
        <label className="field-label">Color</label>
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map(c => <button key={c} onClick={() => setColor(c)}
            className="w-6 h-6 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-1 focus:ring-offset-surface"
            style={{ backgroundColor: c, border: color === c ? '2px solid white' : '2px solid transparent', transform: color === c ? 'scale(1.15)' : '' }} />)}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && <button onClick={onCancel} className="text-xs px-3 py-1.5 text-white/30 hover:text-white/80 transition-colors">Cancel</button>}
        <button onClick={handleSubmit} disabled={!isValid}
          className="btn-primary"
          title={!isValid ? 'Fill in Name and Path to repo' : ''}>
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
