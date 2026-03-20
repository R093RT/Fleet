'use client'

import { useStore, type Agent } from '@/lib/store'
import { formatTime } from '@/lib/utils'

interface SessionStatsBarProps {
  agent: Agent
  streaming: boolean
}

export function SessionStatsBar({ agent, streaming }: SessionStatsBarProps) {
  const { updateAgent } = useStore()

  if (agent.sessionStartedAt == null && agent.sessionCost === 0) return null

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/5 text-xs font-mono">
      {agent.sessionStartedAt != null && (
        <span className="text-white/30">started {formatTime(agent.sessionStartedAt)}</span>
      )}
      {agent.sessionCost > 0 && (
        <span className={agent.budgetCap != null && agent.sessionCost >= agent.budgetCap ? 'text-red-400' : agent.budgetCap != null && agent.sessionCost >= agent.budgetCap * 0.8 ? 'text-amber-400' : 'text-amber/60'}>
          ${agent.sessionCost.toFixed(4)}
        </span>
      )}
      {agent.sessionTurns > 0 && (
        <span className="text-white/30">{agent.sessionTurns} run{agent.sessionTurns !== 1 ? 's' : ''}</span>
      )}
      {agent.sessionTokens != null && agent.sessionTokens > 0 && (
        <span className="text-white/25">{(agent.sessionTokens / 1000).toFixed(1)}k tok</span>
      )}
      {agent.iterationRound > 0 && (
        <span className="text-purple-400/60">round {agent.iterationRound}</span>
      )}
      {agent.iterationScore != null && agent.iterationRound > 0 && (
        <span className="text-white/40">auto {agent.iterationScore}/100</span>
      )}
      {!streaming && (
        <button
          onClick={() => updateAgent(agent.id, {
            sessionCost: 0, sessionTurns: 0, sessionTokens: null,
            sessionStartedAt: null, sessionId: null,
          })}
          className="ml-auto text-white/15 hover:text-white/50 transition-all"
          title="Reset session stats">
          ↺ reset
        </button>
      )}
    </div>
  )
}
