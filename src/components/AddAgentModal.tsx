'use client'

import { useStore } from '@/lib/store'
import { AgentForm, type AgentFormValues } from './AgentForm'

export function AddAgentModal({ onClose }: { onClose: () => void }) {
  const { addAgent } = useStore()

  const handleSubmit = (v: AgentFormValues) => {
    const repo = v.path.replace(/\\/g, '/').split('/').pop() || v.name
    addAgent({ name: v.name, role: v.role, repo, path: v.path, icon: v.icon, color: v.color, devPort: v.devPort ? parseInt(v.devPort) : null })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-raised border border-white/10 rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
          <span className="text-sm font-semibold">New Agent</span>
          <button onClick={onClose} className="text-xs opacity-30 hover:opacity-100">ESC</button>
        </div>
        <div className="p-5">
          <AgentForm submitLabel="Add Agent" onSubmit={handleSubmit} onCancel={onClose} />
        </div>
      </div>
    </div>
  )
}
