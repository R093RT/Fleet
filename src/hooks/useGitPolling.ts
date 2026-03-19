'use client'

import { useEffect } from 'react'
import { useStore } from '@/lib/store'

export function useGitPolling(): void {
  const agents = useStore(s => s.agents)
  const updateAgent = useStore(s => s.updateAgent)

  useEffect(() => {
    const poll = async () => {
      const paths = [...new Set(agents.map(a => a.path).filter(Boolean))]
      if (paths.length === 0) return
      try {
        const res = await fetch('/api/git-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paths }),
        })
        const data = await res.json()
        for (const agent of agents) {
          if (data[agent.path]) {
            updateAgent(agent.id, { git: data[agent.path] })
          }
        }
      } catch {}
    }
    poll()
    const interval = setInterval(poll, 15000)
    return () => clearInterval(interval)
    // agents.length used (not agents) to avoid restarting the interval on every agent field change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.length])
}
