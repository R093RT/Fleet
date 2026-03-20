'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { PT } from './PirateTerm'
import { TreasureChestIcon } from './PirateDecorations'
import { usePirateMode, usePirateClass } from '@/hooks/usePirateMode'

export function VoyageProgress() {
  const { voyage, agents, completeVoyageTask } = useStore()
  const [expanded, setExpanded] = useState(false)
  const isPirate = usePirateMode()
  const pirateFont = usePirateClass()

  if (!voyage) return null

  const completed = voyage.tasks.filter(t => t.completed).length
  const total = voyage.tasks.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  // Morale = average score of agents with scores
  const scored = agents.filter(a => a.score !== null)
  const morale = scored.length > 0 ? Math.round(scored.reduce((t, a) => t + (a.score || 0), 0) / scored.length) : null

  // Treasure = total session cost
  const treasure = agents.reduce((t, a) => t + a.sessionCost, 0)

  // Loot = total uncommitted + unpushed
  const loot = agents.reduce((t, a) => t + (a.git?.uncommitted ?? 0) + (a.git?.unpushed ?? 0), 0)

  // Active crew
  const atSea = agents.filter(a => a.status === 'running').length

  return (
    <div className="max-w-6xl mx-auto px-5 pt-3">
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div
          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none"
          onClick={() => setExpanded(e => !e)}
        >
          <span className="text-lg">{isPirate ? '🏴‍☠️' : '📋'}</span>
          <span className={`${pirateFont} text-amber text-sm truncate flex-1`}>{voyage.name}</span>

          {/* Progress bar */}
          <div className="hidden sm:flex items-center gap-2 flex-1 max-w-[200px]">
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-white/40 tabular-nums">{pct}%</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-white/30">
            <span className="tabular-nums">{completed}/{total} tasks</span>
            {atSea > 0 && <span>{atSea} <PT k="At Sea" className="border-0 text-white/30" /></span>}
            {morale !== null && <span className="hidden sm:inline" title="Average Quality Score"><PT k="Morale" className="border-0 text-white/30" />: {morale}</span>}
            {treasure > 0 && (
              <span className="hidden sm:inline tabular-nums" title="API Cost">
                {isPirate && <TreasureChestIcon size={10} className="inline-block mr-0.5 opacity-50" />}
                ${treasure.toFixed(2)}
              </span>
            )}
            {loot > 0 && <span className="hidden sm:inline" title="Git commits">{loot} <PT k="Loot" className="border-0 text-white/30" /></span>}
          </div>

          <span className="text-xs opacity-15">{expanded ? '▲' : '▼'}</span>
        </div>

        {expanded && (
          <div className="border-t border-white/5 px-4 py-3 space-y-1 max-h-[40vh] overflow-y-auto">
            {voyage.tasks.map(task => {
              const taskAgent = agents.find(a => a.id === task.agentId)
              return (
                <div key={task.id} className="flex items-center gap-2 text-xs group">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => completeVoyageTask(task.id)}
                    className="accent-amber-500 w-3 h-3 flex-shrink-0"
                  />
                  <span className={`flex-1 min-w-0 truncate ${task.completed ? 'line-through opacity-30' : 'text-white/60'}`}>
                    {task.name}
                  </span>
                  {taskAgent && (
                    <span className={`text-white/20 flex-shrink-0 ${pirateFont}`}>{taskAgent.name}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
