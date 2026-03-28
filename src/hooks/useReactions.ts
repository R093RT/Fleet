'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useStore, type AgentStatus } from '@/lib/store'
import type { ReactionConfig } from '@/lib/reactions'

function matchesPath(filename: string, pattern: string): boolean {
  const f = filename.toLowerCase()
  const p = pattern.toLowerCase()
  return f.includes(p) || f.endsWith(p)
}

export function useReactions() {
  const [reactions, setReactions] = useState<ReactionConfig[]>([])
  const [error, setError] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(true)
  const lastFiredRef = useRef<Record<string, number>>({})
  const [lastFired, setLastFired] = useState<Record<string, number>>({})
  const esRef = useRef<Map<string, EventSource>>(new Map())
  const failCountRef = useRef<Record<string, number>>({})
  // Connection status keyed by repo path
  const [esStatus, setEsStatus] = useState<Record<string, 'connected' | 'error'>>({})

  // Stable string dep: only changes when agent names or paths change, not on status updates
  const agentPathKey = useStore(s => s.agents.map(a => `${a.name}:${a.path}`).join('|'))

  // Fetch config once on mount
  useEffect(() => {
    fetch('/api/reactions')
      .then(r => r.json())
      .then((data: { reactions: ReactionConfig[]; error?: string }) => {
        setReactions(data.reactions ?? [])
        if (data.error) setError(data.error)
      })
      .catch((e: unknown) => {
        console.warn('Failed to load reactions config:', e instanceof Error ? e.message : String(e))
        setError('Failed to load reactions config')
      })
  }, [])

  // Global rate limit: max 5 reaction fires per 10 seconds across all reactions
  const globalFireTimesRef = useRef<number[]>([])
  const GLOBAL_MAX_FIRES = 5
  const GLOBAL_WINDOW_MS = 10_000

  const fireAction = useCallback((reaction: ReactionConfig, filename?: string) => {
    const now = Date.now()

    // Per-reaction cooldown
    const cooldownMs = (reaction.cooldown ?? 60) * 1000
    const lastFiredAt = lastFiredRef.current[reaction.name] ?? 0
    if (now - lastFiredAt < cooldownMs) return

    // Global rate limit
    globalFireTimesRef.current = globalFireTimesRef.current.filter(t => now - t < GLOBAL_WINDOW_MS)
    if (globalFireTimesRef.current.length >= GLOBAL_MAX_FIRES) {
      console.warn(`Reaction rate limit hit (${GLOBAL_MAX_FIRES}/${GLOBAL_WINDOW_MS}ms), skipping: ${reaction.name}`)
      return
    }
    globalFireTimesRef.current.push(now)

    lastFiredRef.current[reaction.name] = now
    setLastFired(prev => ({ ...prev, [reaction.name]: now }))

    const agents = useStore.getState().agents
    const target = agents.find(a => a.name === reaction.action.agent)
    if (!target) return

    if (reaction.action.type === 'set_status' && reaction.action.status) {
      useStore.getState().updateAgent(target.id, {
        status: reaction.action.status as AgentStatus,
        lastUpdate: Date.now(),
      })
    } else if (reaction.action.type === 'send_prompt' && reaction.action.message) {
      const msg = reaction.action.message.replace('{filename}', filename ?? '')
      useStore.getState().updateAgent(target.id, { pendingTrigger: msg })
    }

    useStore.getState().appendMessage(target.id, {
      id: `msg-${Date.now()}-rx`,
      role: 'system',
      content: `⚡ Reaction fired: ${reaction.name}${filename ? ` (${filename})` : ''}`,
      timestamp: Date.now(),
    })
  }, [])

  // Manually fire a reaction bypassing the cooldown (for testing in the UI)
  const fireReaction = useCallback((reactionName: string) => {
    const reaction = reactions.find(r => r.name === reactionName)
    if (!reaction) return
    lastFiredRef.current[reactionName] = 0
    fireAction(reaction, '(manual)')
  }, [reactions, fireAction])

  // Subscribe to file watchers; re-runs when agent paths change or reactions reload
  useEffect(() => {
    if (!enabled || reactions.length === 0) return

    const agents = useStore.getState().agents
    const fileReactions = reactions.filter(r => r.trigger.type === 'file_change')

    // Group by agent path to avoid duplicate EventSources
    const pathsToReactions = new Map<string, ReactionConfig[]>()
    for (const reaction of fileReactions) {
      const triggerAgent = agents.find(a => a.name === reaction.trigger.agent)
      if (!triggerAgent?.path) continue
      const repoPath = triggerAgent.path
      const existing = pathsToReactions.get(repoPath) ?? []
      existing.push(reaction)
      pathsToReactions.set(repoPath, existing)
    }

    for (const [repoPath, repoReactions] of pathsToReactions) {
      if (esRef.current.has(repoPath)) continue
      const es = new EventSource(`/api/watch?path=${encodeURIComponent(repoPath)}`)
      esRef.current.set(repoPath, es)

      es.onopen = () => setEsStatus(prev => ({ ...prev, [repoPath]: 'connected' }))
      es.onerror = () => setEsStatus(prev => ({ ...prev, [repoPath]: 'error' }))
      es.onmessage = (e: MessageEvent<string>) => {
        try {
          const data = JSON.parse(e.data) as { event: string; filename: string }
          if (!data.filename) return
          for (const reaction of repoReactions) {
            const pattern = reaction.trigger.path
            if (!pattern || matchesPath(data.filename, pattern)) {
              fireAction(reaction, data.filename)
            }
          }
        } catch {}
      }
    }

    return () => {
      for (const es of esRef.current.values()) es.close()
      esRef.current.clear()
      setEsStatus({})
    }
  }, [enabled, reactions, fireAction, agentPathKey])

  // Poll ports for port_unavailable reactions
  useEffect(() => {
    if (!enabled) return
    const portReactions = reactions.filter(r => r.trigger.type === 'port_unavailable' && r.trigger.port)
    if (portReactions.length === 0) return

    const interval = setInterval(() => {
      for (const reaction of portReactions) {
        const port = reaction.trigger.port!
        fetch(`http://localhost:${port}`, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
          .then(() => { failCountRef.current[reaction.name] = 0 })
          .catch(() => {
            const fails = (failCountRef.current[reaction.name] ?? 0) + 1
            failCountRef.current[reaction.name] = fails
            if (fails >= 3) {
              failCountRef.current[reaction.name] = 0
              fireAction(reaction)
            }
          })
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [enabled, reactions, fireAction])

  // Map reaction name → connection status (using agentPathKey to stay fresh)
  const reactionStatus = useMemo(() => {
    const result: Record<string, 'connected' | 'error' | 'idle' | 'no-agent'> = {}
    const agents = useStore.getState().agents
    for (const r of reactions) {
      if (r.trigger.type === 'port_unavailable') {
        result[r.name] = 'idle'
        continue
      }
      const agent = agents.find(a => a.name === r.trigger.agent)
      if (!agent?.path) {
        result[r.name] = 'no-agent'
      } else {
        result[r.name] = esStatus[agent.path] ?? 'idle'
      }
    }
    return result
    // agentPathKey ensures recomputation when agent names/paths change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactions, esStatus, agentPathKey])

  return { reactions, lastFired, error, enabled, setEnabled, fireReaction, reactionStatus }
}
