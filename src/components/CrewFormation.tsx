'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { PT } from './PirateTerm'
import { CrossedSwordsIcon } from './PirateDecorations'
import { usePirateClass, usePirateText } from '@/hooks/usePirateMode'
import { assignPirateIdentities, PIRATE_NAMES } from '@/lib/pirate-names'
import type { PirateAssignment, Workstream } from '@/lib/pirate-names'
import type { AnalysisResult } from '@/app/api/analyze-roadmap/route'

function territoriesOverlap(a: string, b: string): boolean {
  if (a === b) return true
  const aBase = a.replace(/\/?\*\*$/, '')
  const bBase = b.replace(/\/?\*\*$/, '')
  if (aBase.startsWith(bBase + '/') || bBase.startsWith(aBase + '/')) return true
  return aBase === bBase
}

interface OverlapEntry { partnerIdx: number; patterns: string[] }

function computeOverlaps(crew: PirateAssignment[]): Map<number, OverlapEntry[]> {
  const overlaps = new Map<number, OverlapEntry[]>()
  for (let i = 0; i < crew.length; i++) {
    for (let j = i + 1; j < crew.length; j++) {
      const shared: string[] = []
      for (const a of crew[i]!.territory) {
        for (const b of crew[j]!.territory) {
          if (territoriesOverlap(a, b)) {
            shared.push(a === b ? a : `${a} / ${b}`)
          }
        }
      }
      if (shared.length > 0) {
        if (!overlaps.has(i)) overlaps.set(i, [])
        if (!overlaps.has(j)) overlaps.set(j, [])
        overlaps.get(i)!.push({ partnerIdx: j, patterns: shared })
        overlaps.get(j)!.push({ partnerIdx: i, patterns: shared })
      }
    }
  }
  return overlaps
}

/**
 * Auto-resolve territory overlaps: for each contested path, assign it to the
 * best-matching agent (by keyword affinity) and remove from all others.
 */
function deduplicateTerritories(crew: PirateAssignment[]): PirateAssignment[] {
  if (crew.length <= 1) return crew

  // Build a map: territory pattern → list of agent indices that claim it
  const claims = new Map<string, number[]>()
  for (let i = 0; i < crew.length; i++) {
    for (const t of crew[i]!.territory) {
      // Normalize: strip trailing /** for grouping
      const key = t.replace(/\/?\*\*$/, '').toLowerCase()
      // Check against existing claims for overlaps
      let foundKey: string | null = null
      for (const [existing] of claims) {
        if (key === existing || key.startsWith(existing + '/') || existing.startsWith(key + '/')) {
          foundKey = existing
          break
        }
      }
      const useKey = foundKey ?? key
      if (!claims.has(useKey)) claims.set(useKey, [])
      if (!claims.get(useKey)!.includes(i)) claims.get(useKey)!.push(i)
    }
  }

  // For contested territories, pick the best owner
  const removed = new Map<number, Set<string>>() // agentIdx → set of territory patterns to remove

  for (const [, agents] of claims) {
    if (agents.length <= 1) continue

    // Score each agent: how many of their tasks/description words match the territory path segments
    let bestIdx = agents[0]!
    let bestScore = -1
    for (const idx of agents) {
      const agent = crew[idx]!
      const text = [agent.name, agent.description, ...agent.tasks, agent.domain].join(' ').toLowerCase()
      // Count territory-specific path segments that appear in the agent's text
      let score = 0
      for (const t of agent.territory) {
        const parts = t.replace(/\/?\*\*$/, '').split('/').filter(Boolean)
        for (const part of parts) {
          if (text.includes(part.toLowerCase())) score++
        }
      }
      // Tiebreaker: fewer total territories = more focused agent = better owner
      score += 1 / (agent.territory.length + 1)
      if (score > bestScore) {
        bestScore = score
        bestIdx = idx
      }
    }

    // Remove the contested territory from all non-winners
    for (const idx of agents) {
      if (idx === bestIdx) continue
      if (!removed.has(idx)) removed.set(idx, new Set())
      for (const t of crew[idx]!.territory) {
        const tKey = t.replace(/\/?\*\*$/, '').toLowerCase()
        // Check if this territory is part of the contested group
        for (const [claimKey, claimAgents] of claims) {
          if (claimAgents.length <= 1) continue
          if (tKey === claimKey || tKey.startsWith(claimKey + '/') || claimKey.startsWith(tKey + '/')) {
            removed.get(idx)!.add(t)
          }
        }
      }
    }
  }

  // Apply removals
  if (removed.size === 0) return crew
  return crew.map((member, idx) => {
    const toRemove = removed.get(idx)
    if (!toRemove || toRemove.size === 0) return member
    return { ...member, territory: member.territory.filter(t => !toRemove.has(t)) }
  })
}

interface CrewFormationProps {
  analysis: AnalysisResult
  treasureMap: string
  onSetSail: (crew: PirateAssignment[], repos: string[]) => void
  onBack: () => void
}

export function CrewFormation({ analysis, treasureMap, onSetSail, onBack }: CrewFormationProps) {
  const pirateFont = usePirateClass()
  const t = usePirateText()
  const [crew, setCrew] = useState<PirateAssignment[]>(() =>
    deduplicateTerritories(assignPirateIdentities(analysis.workstreams))
  )
  const [crewSize, setCrewSize] = useState(analysis.recommendedCrewSize)
  const [reAnalyzing, setReAnalyzing] = useState(false)
  const [repos, setRepos] = useState<string[]>(analysis.repos)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const maxCrew = Math.max(Math.min(analysis.workstreams.length * 2, 12), crew.length)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reAnalyze = useCallback(async (size: number) => {
    setReAnalyzing(true)
    try {
      const res = await fetch('/api/analyze-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roadmap: treasureMap, crewSize: size }),
      })
      const data = await res.json() as AnalysisResult & { error?: string }
      if (data.error) throw new Error(data.error)
      setCrew(deduplicateTerritories(assignPirateIdentities(data.workstreams)))
      if (data.repos.length > 0) setRepos(data.repos)
    } catch {
      // Keep existing crew on failure
    }
    setReAnalyzing(false)
  }, [treasureMap])

  const handleCrewSizeChange = (size: number) => {
    setCrewSize(size)
    // Debounce re-analysis to avoid firing on every slider pixel
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void reAnalyze(size), 500)
  }

  const rerollName = (idx: number) => {
    const used = new Set(crew.map(c => c.pirateName))
    const available = PIRATE_NAMES.filter(n => !used.has(n.name))
    const pick = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]!
      : PIRATE_NAMES[Math.floor(Math.random() * PIRATE_NAMES.length)]!
    setCrew(prev => prev.map((c, i) => i === idx ? { ...c, pirateName: pick.name, pirateIcon: pick.icon } : c))
  }

  const updateCrewMember = (idx: number, updates: Partial<PirateAssignment>) => {
    setCrew(prev => prev.map((c, i) => i === idx ? { ...c, ...updates } : c))
  }

  const removeCrew = (idx: number) => {
    setCrew(prev => prev.filter((_, i) => i !== idx))
    setCrewSize(prev => prev - 1)
  }

  const mergeCrew = (keepIdx: number, mergeIdx: number) => {
    setCrew(prev => {
      const keep = prev[keepIdx]
      const merge = prev[mergeIdx]
      if (!keep || !merge) return prev
      const merged: PirateAssignment = {
        ...keep,
        description: keep.description + '; ' + merge.description,
        tasks: [...keep.tasks, ...merge.tasks],
        territory: [...new Set([...keep.territory, ...merge.territory])],
        dependencies: [...new Set([...keep.dependencies, ...merge.dependencies])],
        complexity: Math.max(keep.complexity, merge.complexity),
      }
      return prev.map((c, i) => i === keepIdx ? merged : c).filter((_, i) => i !== mergeIdx)
    })
    setCrewSize(prev => prev - 1)
  }

  const addBlank = () => {
    const newWs: Workstream = {
      name: 'New Workstream',
      description: '',
      tasks: [],
      complexity: 1,
      dependencies: [],
      domain: 'general',
      territory: [],
    }
    const [assigned] = assignPirateIdentities([newWs])
    if (assigned) {
      setCrew(prev => [...prev, assigned])
      setCrewSize(prev => prev + 1)
    }
  }


  const [showRepos, setShowRepos] = useState(false)
  const [editingTerritoryIdx, setEditingTerritoryIdx] = useState<number | null>(null)
  const [overlapDismissed, setOverlapDismissed] = useState(false)
  const [showWhy, setShowWhy] = useState(false)

  // Default repo = first repo; only show per-card dropdown when agent differs from default
  const defaultRepo = repos[0] ?? ''
  const MAX_VISIBLE_TASKS = 4
  const overlaps = useMemo(() => computeOverlaps(crew), [crew])

  // Reset dismiss when overlap count changes
  useEffect(() => { setOverlapDismissed(false) }, [overlaps.size])

  return (
    <div className="space-y-3">
      {/* Top bar: summary + controls */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        {/* Summary — full width, allows wrapping */}
        <p className={`${pirateFont} text-base text-amber leading-snug`}>{analysis.summary}</p>
        <p className="text-xs text-white/30 mt-1">
          {analysis.recommendedCrewSize} {t('pirates', 'agents')} recommended — <button type="button" onClick={() => setShowWhy(v => !v)} className="cursor-pointer border-b border-dotted border-white/20 hover:text-white/50 transition-colors">why?</button>
        </p>
        {showWhy && (
          <p className="text-xs text-white/25 mt-1.5 leading-relaxed bg-white/[0.02] rounded px-2 py-1.5 border border-white/5">
            {analysis.reasoning}
          </p>
        )}

        {/* Controls row */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5 flex-wrap">
          {/* Crew size slider */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-white/40">Crew</span>
            <input
              type="range"
              min={1}
              max={maxCrew}
              value={crewSize}
              onChange={e => handleCrewSizeChange(parseInt(e.target.value))}
              className="w-32 accent-amber-500"
              disabled={reAnalyzing}
            />
            <span className="text-sm text-amber tabular-nums w-20">{crew.length} {t('pirates', 'agents')}</span>
          </div>

          {reAnalyzing && (
            <span className="text-xs text-amber/60 animate-pulse">{t('Re-consulting the stars...', 'Re-analyzing...')}</span>
          )}

          {/* Repos toggle */}
          {repos.length > 0 && (
            <button
              onClick={() => setShowRepos(v => !v)}
              className="text-xs text-white/25 hover:text-white/50 transition-colors"
            >
              {showRepos ? '▾' : '▸'} {repos.length} repo{repos.length !== 1 ? 's' : ''}
            </button>
          )}

          {/* Actions — pushed right */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <button onClick={onBack} className="btn-ghost text-xs">← Back</button>
            <button onClick={addBlank} className="btn-ghost text-xs">+ <PT k="Recruit" className="border-0" /></button>
            <button
              onClick={() => onSetSail(crew, repos)}
              disabled={crew.length === 0 || reAnalyzing}
              className="btn-primary px-5 py-1.5"
            >
              <PT k="Set Sail" className="border-0" />
            </button>
          </div>
        </div>

        {/* Repo paths — collapsible */}
        {showRepos && repos.length > 0 && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5 flex-wrap">
            <span className="text-xs text-white/30 flex-shrink-0">Repos:</span>
            {repos.map((r, i) => (
              <input
                key={i}
                value={r}
                onChange={e => setRepos(prev => prev.map((p, j) => j === i ? e.target.value : p))}
                className="input-field-sm font-mono text-xs flex-1 min-w-[200px]"
                title={r}
              />
            ))}
          </div>
        )}
      </div>

      {/* Overlap warning banner */}
      {overlaps.size > 0 && !overlapDismissed && (
        <div className="rounded border border-orange-500/20 bg-orange-500/[0.05] px-3 py-2 text-xs text-orange-400/80">
          <div className="flex items-start gap-2">
            <span className="mt-0.5">⚠</span>
            <div className="flex-1 space-y-1">
              <span>{overlaps.size} {t('crew members', 'agents')} have overlapping territories — they may edit the same files and cause merge conflicts.</span>
              <div className="text-orange-400/50">
                Fix: click a territory to edit it, or use the <strong>merge</strong> button on overlapping cards to combine them into one agent.
              </div>
            </div>
            <button onClick={() => setOverlapDismissed(true)} className="text-orange-400/30 hover:text-orange-400/60 transition-colors flex-shrink-0" title="Dismiss">✕</button>
          </div>
        </div>
      )}

      {/* 4-column agent grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1 content-start">
        {crew.map((member, idx) => {
          const memberRepo = member.repoPath ?? defaultRepo
          const repoLabel = memberRepo.replace(/\\/g, '/').split('/').pop() ?? memberRepo
          const defaultRepoLabel = defaultRepo.replace(/\\/g, '/').split('/').pop() ?? defaultRepo
          const isCustomRepo = repos.length > 1 && repoLabel !== defaultRepoLabel

          return (
            <div key={idx} className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              {/* Color accent bar + name header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5"
                style={{ borderLeftWidth: 3, borderLeftColor: member.pirateColor }}>
                <span className="text-base flex-shrink-0">{member.pirateIcon}</span>
                <div className="flex-1 min-w-0">
                  {editingIdx === idx ? (
                    <input
                      value={member.pirateName}
                      onChange={e => updateCrewMember(idx, { pirateName: e.target.value })}
                      onBlur={() => setEditingIdx(null)}
                      onKeyDown={e => e.key === 'Enter' && setEditingIdx(null)}
                      className="input-field-sm text-amber w-full"
                      autoFocus
                    />
                  ) : (
                    <span className={`${pirateFont} text-amber text-sm cursor-pointer hover:opacity-80 truncate block`} onClick={() => setEditingIdx(idx)}>
                      {member.pirateName}
                    </span>
                  )}
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/35 flex-shrink-0 uppercase tracking-wider">
                  <PT k={member.pirateRole} className="border-0" />
                </span>
                <button onClick={() => rerollName(idx)} className="text-xs text-white/15 hover:text-amber transition-colors flex-shrink-0" title="Re-roll name">🎲</button>
                <button onClick={() => removeCrew(idx)} className="text-xs text-white/15 hover:text-red-400 transition-colors flex-shrink-0" title="Remove">✕</button>
              </div>

              {/* Body */}
              <div className="px-3 py-2 space-y-2">
                {/* Description */}
                <p className="text-xs text-white/50 leading-relaxed">{member.description}</p>

                {/* Tasks — capped at MAX_VISIBLE_TASKS */}
                {member.tasks.length > 0 && (
                  <div className="space-y-1">
                    {member.tasks.slice(0, MAX_VISIBLE_TASKS).map((task, ti) => (
                      <div key={ti} className="text-xs text-white/35 flex items-start gap-1.5 group/task">
                        <span className="text-amber/40 mt-0.5 flex-shrink-0">›</span>
                        <span className="leading-relaxed flex-1">{task}</span>
                        <button
                          onClick={() => updateCrewMember(idx, { tasks: member.tasks.filter((_, i) => i !== ti) })}
                          className="text-white/0 group-hover/task:text-white/20 hover:!text-red-400 transition-colors flex-shrink-0 mt-0.5"
                          title="Remove task"
                        >✕</button>
                      </div>
                    ))}
                    {member.tasks.length > MAX_VISIBLE_TASKS && (
                      <span className="text-xs text-white/20">+{member.tasks.length - MAX_VISIBLE_TASKS} more</span>
                    )}
                  </div>
                )}

                {/* Territory */}
                {editingTerritoryIdx === idx ? (
                  <div className="space-y-1">
                    <div className="text-[10px] text-white/25 uppercase tracking-wider">Territory</div>
                    <textarea
                      value={member.territory.join('\n')}
                      onChange={e => updateCrewMember(idx, { territory: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                      onBlur={() => setEditingTerritoryIdx(null)}
                      rows={3}
                      className="w-full text-[11px] font-mono bg-white/[0.03] border border-white/[0.06] rounded px-2 py-1 text-white/40 outline-none resize-none"
                      placeholder={"src/components/**\nsrc/lib/store.ts"}
                      autoFocus
                    />
                  </div>
                ) : member.territory.length > 0 ? (
                  <div className="space-y-1" onClick={() => setEditingTerritoryIdx(idx)} title="Click to edit territory">
                    <div className="text-[10px] text-white/25 uppercase tracking-wider cursor-pointer">Territory</div>
                    <div className="flex flex-wrap gap-1 cursor-pointer">
                      {member.territory.map((tp, ti) => (
                        <span key={ti} className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30 border border-white/[0.06]">
                          {tp}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { updateCrewMember(idx, { territory: [''] }); setEditingTerritoryIdx(idx) }}
                    className="text-[10px] text-white/15 hover:text-white/30 transition-colors"
                  >
                    + territory
                  </button>
                )}

                {/* Per-card overlap warnings */}
                {overlaps.get(idx)?.map((o, oi) => (
                  <div key={oi} className="text-[11px] text-orange-400/70 space-y-1">
                    <div className="flex items-start gap-1.5">
                      <span className="mt-px">⚠</span>
                      <span className="flex-1">
                        Overlaps with {crew[o.partnerIdx]?.pirateName}: {o.patterns.slice(0, 2).join(', ')}
                        {o.patterns.length > 2 ? ` +${o.patterns.length - 2} more` : ''}
                      </span>
                    </div>
                    <div className="flex gap-1.5 ml-4">
                      <button
                        onClick={() => setEditingTerritoryIdx(idx)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/15 hover:bg-orange-500/20 transition-colors"
                      >edit territory</button>
                      <button
                        onClick={() => mergeCrew(idx, o.partnerIdx)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/15 hover:bg-orange-500/20 transition-colors"
                        title={`Merge ${crew[o.partnerIdx]?.pirateName}'s tasks and territory into ${member.pirateName}`}
                      >merge into this</button>
                    </div>
                  </div>
                ))}

                {/* Dependencies */}
                {member.dependencies.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-white/25 pt-0.5">
                    <CrossedSwordsIcon size={10} />
                    <span>Depends on: {member.dependencies.join(', ')}</span>
                  </div>
                )}

                {/* Per-member repo — only shown when different from default */}
                {isCustomRepo && (
                  <div className="text-[11px] text-white/20 pt-0.5">
                    Repo: {repoLabel}
                  </div>
                )}

                {/* Repo override — only when multiple repos, on click */}
                {repos.length > 1 && (
                  <select
                    value={memberRepo}
                    onChange={e => updateCrewMember(idx, { repoPath: e.target.value })}
                    className="w-full text-xs bg-white/[0.03] border border-white/[0.06] rounded px-1.5 py-1 text-white/30 outline-none"
                  >
                    {repos.map((r, ri) => (
                      <option key={ri} value={r}>{r.replace(/\\/g, '/').split('/').pop() || r}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
