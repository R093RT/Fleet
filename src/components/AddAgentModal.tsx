'use client'

import { useStore } from '@/lib/store'
import { AgentForm, type AgentFormValues } from './AgentForm'
import { usePirateClass, usePirateText } from '@/hooks/usePirateMode'
import { useFocusTrap } from '@/hooks/useFocusTrap'

export function AddAgentModal({ onClose }: { onClose: () => void }) {
  const { addAgent } = useStore()
  const pirateFont = usePirateClass()
  const t = usePirateText()
  const trapRef = useFocusTrap<HTMLDivElement>()

  const handleSubmit = (v: AgentFormValues) => {
    const repo = v.path.replace(/\\/g, '/').split('/').pop() || v.name
    // Inherit daily budget cap as per-agent default (if set)
    const { dailyBudgetCap, agents } = useStore.getState()
    const activeCount = agents.length + 1
    const defaultBudget = dailyBudgetCap != null ? Math.round((dailyBudgetCap / activeCount) * 100) / 100 : null
    addAgent({ name: v.name, role: v.role, repo, path: v.path, icon: v.icon, color: v.color, devPort: v.devPort ? parseInt(v.devPort) : null, agentType: v.agentType, model: v.model, budgetCap: defaultBudget })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title-add">
      <div ref={trapRef} className="modal-content w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08]">
          <span id="modal-title-add" className={`text-sm ${pirateFont} text-amber`}>{t('Recruit a Pirate', 'Add Agent')}</span>
          <button onClick={onClose} className="text-xs opacity-30 hover:opacity-100 transition-opacity" aria-label="Close">ESC</button>
        </div>
        <div className="p-5">
          <AgentForm submitLabel={t('Recruit', 'Add')} onSubmit={handleSubmit} onCancel={onClose} />
        </div>
      </div>
    </div>
  )
}
