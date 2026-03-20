'use client'

import { useStore } from '@/lib/store'
import { AgentForm, type AgentFormValues } from './AgentForm'
import { usePirateClass, usePirateText } from '@/hooks/usePirateMode'

export function AddAgentModal({ onClose }: { onClose: () => void }) {
  const { addAgent } = useStore()
  const pirateFont = usePirateClass()
  const t = usePirateText()

  const handleSubmit = (v: AgentFormValues) => {
    const repo = v.path.replace(/\\/g, '/').split('/').pop() || v.name
    addAgent({ name: v.name, role: v.role, repo, path: v.path, icon: v.icon, color: v.color, devPort: v.devPort ? parseInt(v.devPort) : null, agentType: v.agentType })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08]">
          <span className={`text-sm ${pirateFont} text-amber`}>{t('Recruit a Pirate', 'Add Agent')}</span>
          <button onClick={onClose} className="text-xs opacity-30 hover:opacity-100 transition-opacity">ESC</button>
        </div>
        <div className="p-5">
          <AgentForm submitLabel={t('Recruit', 'Add')} onSubmit={handleSubmit} onCancel={onClose} />
        </div>
      </div>
    </div>
  )
}
