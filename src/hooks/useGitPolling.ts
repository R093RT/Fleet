'use client'

import { useEffect } from 'react'
import { useStore } from '@/lib/store'

export function useGitPolling(): void {
  const agentCount = useStore(s => s.agents.length)

  useEffect(() => {
    const poll = async () => {
      // Read fresh agents to avoid stale closure (effect only restarts on agentCount change)
      const freshAgents = useStore.getState().agents
      const isAbsolute = (p: string) => /^[A-Za-z]:[/\\]|^\//.test(p)
      const paths = [...new Set(freshAgents.map(a => a.worktreePath || a.path).filter(p => p && isAbsolute(p)))]
      if (paths.length === 0) return
      try {
        const res = await fetch('/api/git-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths }),
        })
        const data = await res.json()
        const { updateAgent } = useStore.getState()
        for (const agent of freshAgents) {
          const key = agent.worktreePath || agent.path
          if (data[key]) {
            updateAgent(agent.id, { git: data[key] })
          }
        }
      } catch (e) {
        console.warn('Git polling failed:', e instanceof Error ? e.message : String(e))
      }
    }
    poll()
    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
  }, [agentCount])
}
