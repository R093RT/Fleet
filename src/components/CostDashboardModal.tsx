'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { PT } from './PirateTerm'
import { useFocusTrap } from '@/hooks/useFocusTrap'

type Range = 7 | 14 | 30

function getDaysInRange(range: Range): string[] {
  const days: string[] = []
  const now = new Date()
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function BarChart({ dailySpend, budgetCap, range }: { dailySpend: Record<string, number>; budgetCap: number | null; range: Range }) {
  const days = getDaysInRange(range)
  const values = days.map(d => dailySpend[d] ?? 0)
  const maxVal = Math.max(...values, budgetCap ?? 0, 0.01)
  const chartW = 500
  const chartH = 160
  const barW = Math.max(4, (chartW - 40) / days.length - 2)
  const barGap = 2

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH + 30}`} className="w-full h-auto">
      {/* Y-axis labels */}
      <text x="0" y="12" className="fill-white/30" fontSize="9" fontFamily="monospace">${maxVal.toFixed(2)}</text>
      <text x="0" y={chartH} className="fill-white/30" fontSize="9" fontFamily="monospace">$0</text>

      {/* Budget cap line */}
      {budgetCap != null && budgetCap > 0 && (
        <>
          <line
            x1="35" y1={chartH - (budgetCap / maxVal) * chartH}
            x2={chartW} y2={chartH - (budgetCap / maxVal) * chartH}
            stroke="#f87171" strokeWidth="1" strokeDasharray="4 3" opacity="0.5"
          />
          <text x={chartW - 2} y={chartH - (budgetCap / maxVal) * chartH - 3} textAnchor="end" className="fill-red-400/60" fontSize="8" fontFamily="monospace">cap ${budgetCap.toFixed(2)}</text>
        </>
      )}

      {/* Bars */}
      {values.map((v, i) => {
        const barH = Math.max(1, (v / maxVal) * chartH)
        const x = 38 + i * (barW + barGap)
        const y = chartH - barH
        const overBudget = budgetCap != null && v >= budgetCap
        return (
          <g key={days[i]}>
            <rect x={x} y={y} width={barW} height={barH} rx="1"
              fill={overBudget ? '#f87171' : '#d4a843'} opacity={v > 0 ? 0.7 : 0.1}
            />
            {/* X-axis label — show every few days to avoid crowding */}
            {(i % Math.ceil(range / 10) === 0 || i === days.length - 1) && (
              <text x={x + barW / 2} y={chartH + 14} textAnchor="middle" className="fill-white/20" fontSize="7" fontFamily="monospace">
                {(days[i] ?? '').slice(5)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

export function CostDashboardModal({ onClose }: { onClose: () => void }) {
  const { agents, dailySpend, dailyBudgetCap } = useStore()
  const [range, setRange] = useState<Range>(7)
  const trapRef = useFocusTrap<HTMLDivElement>()

  const totalSpend = Object.values(dailySpend).reduce((s, v) => s + v, 0)
  const today = new Date().toISOString().slice(0, 10)
  const todaySpend = dailySpend[today] ?? 0

  // Per-agent breakdown
  const agentRows = agents
    .map(a => ({
      name: a.name,
      color: a.color,
      cost: a.sessionCost,
      turns: a.sessionTurns,
      tokens: a.sessionTokens ?? 0,
      budgetCap: a.budgetCap,
      pct: a.budgetCap ? Math.min(100, (a.sessionCost / a.budgetCap) * 100) : null,
    }))
    .sort((a, b) => b.cost - a.cost)

  const totalTokens = agentRows.reduce((s, r) => s + r.tokens, 0)
  const totalTurns = agentRows.reduce((s, r) => s + r.turns, 0)

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title-cost">
      <div ref={trapRef} className="bg-surface-raised border border-white/[0.08] rounded-xl w-full max-w-2xl max-h-[85vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h2 id="modal-title-cost" className="text-sm font-medium text-white/90"><PT k="Treasure Ledger" className="border-0" /></h2>
            <div className="text-xs text-white/30 mt-0.5">${totalSpend.toFixed(4)} total · ${todaySpend.toFixed(4)} today</div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 text-lg px-2" aria-label="Close">×</button>
        </div>

        {/* Daily chart */}
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-white/40">Daily spend</span>
            <div className="flex gap-1 ml-auto">
              {([7, 14, 30] as Range[]).map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className="text-xs px-2 py-0.5 rounded transition-all"
                  style={{
                    backgroundColor: range === r ? 'rgba(255,255,255,0.08)' : 'transparent',
                    color: range === r ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)',
                  }}>
                  {r}d
                </button>
              ))}
            </div>
          </div>
          <BarChart dailySpend={dailySpend} budgetCap={dailyBudgetCap} range={range} />
        </div>

        {/* Per-agent breakdown */}
        <div className="px-5 py-4">
          <div className="text-xs text-white/40 mb-3">Per-agent breakdown</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/25 border-b border-white/5">
                <th className="text-left py-1.5 font-normal">Agent</th>
                <th className="text-right py-1.5 font-normal">Cost</th>
                <th className="text-right py-1.5 font-normal">Turns</th>
                <th className="text-right py-1.5 font-normal">Tokens</th>
                <th className="text-right py-1.5 font-normal">Cap</th>
                <th className="text-right py-1.5 font-normal">Used</th>
              </tr>
            </thead>
            <tbody>
              {agentRows.map(r => (
                <tr key={r.name} className="border-b border-white/[0.03] text-white/60 hover:bg-white/[0.02]">
                  <td className="py-1.5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                    {r.name}
                  </td>
                  <td className="text-right tabular-nums font-mono">${r.cost.toFixed(4)}</td>
                  <td className="text-right tabular-nums">{r.turns}</td>
                  <td className="text-right tabular-nums">{r.tokens.toLocaleString()}</td>
                  <td className="text-right tabular-nums font-mono">{r.budgetCap != null ? `$${r.budgetCap.toFixed(2)}` : '—'}</td>
                  <td className="text-right tabular-nums">
                    {r.pct != null ? (
                      <span className={r.pct >= 90 ? 'text-red-400' : r.pct >= 70 ? 'text-amber-400' : ''}>{r.pct.toFixed(0)}%</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
              {/* Totals */}
              <tr className="border-t border-white/10 text-white/70 font-medium">
                <td className="py-1.5">Total</td>
                <td className="text-right tabular-nums font-mono">${agentRows.reduce((s, r) => s + r.cost, 0).toFixed(4)}</td>
                <td className="text-right tabular-nums">{totalTurns}</td>
                <td className="text-right tabular-nums">{totalTokens.toLocaleString()}</td>
                <td className="text-right">—</td>
                <td className="text-right">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
