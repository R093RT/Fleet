'use client'

import { useEffect } from 'react'
import { useStore } from '@/lib/store'

export function useSessionRecovery(): void {
  useEffect(() => {
    fetch('/api/sessions')
      .then(r => r.json())
      .then((data: { sessions?: Array<{ agentId: string; totalCost: number; totalRuns: number; totalTokens: number }> }) => {
        const currentAgents = useStore.getState().agents
        for (const s of data.sessions ?? []) {
          const agent = currentAgents.find(a => a.id === s.agentId)
          if (agent && agent.sessionCost === 0 && s.totalCost > 0) {
            useStore.getState().updateAgent(s.agentId, {
              sessionCost: s.totalCost,
              sessionTurns: s.totalRuns,
              sessionTokens: s.totalTokens > 0 ? s.totalTokens : null,
            })
          }
        }
      })
      .catch(() => {})
  }, [])
}
