'use client'

import { useState, useCallback, useRef } from 'react'
import { PT } from './PirateTerm'
import { CrossedSwordsIcon, SkullIcon } from './PirateDecorations'
import { usePirateClass, usePirateText } from '@/hooks/usePirateMode'
import { assignPirateIdentities, PIRATE_NAMES, DOMAIN_TO_ROLE } from '@/lib/pirate-names'
import type { PirateAssignment, Workstream } from '@/lib/pirate-names'
import type { AnalysisResult } from '@/app/api/analyze-roadmap/route'

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
    assignPirateIdentities(analysis.workstreams)
  )
  const [crewSize, setCrewSize] = useState(analysis.recommendedCrewSize)
  const [reAnalyzing, setReAnalyzing] = useState(false)
  const [repos, setRepos] = useState<string[]>(analysis.repos)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const maxCrew = Math.min(analysis.workstreams.length * 2, 12)
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
      setCrew(assignPirateIdentities(data.workstreams))
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

  const addBlank = () => {
    const newWs: Workstream = {
      name: 'New Workstream',
      description: '',
      tasks: [],
      complexity: 1,
      dependencies: [],
      domain: 'general',
    }
    const [assigned] = assignPirateIdentities([newWs])
    if (assigned) {
      setCrew(prev => [...prev, assigned])
      setCrewSize(prev => prev + 1)
    }
  }

  const complexitySkulls = (n: number) => {
    return Array.from({ length: n }, (_, i) => (
      <SkullIcon key={i} size={12} className="inline-block opacity-50" />
    ))
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className={`${pirateFont} text-2xl text-amber`}>{analysis.summary}</h2>
        <p className="text-xs text-white/30" title={analysis.reasoning}>
          {analysis.recommendedCrewSize} {t('pirates', 'agents')} recommended — <span className="cursor-help border-b border-dotted border-white/10">why?</span>
        </p>
      </div>

      {/* Crew size slider */}
      <div className="space-y-2 px-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/40">Crew Size</span>
          <span className={`text-sm ${pirateFont} text-amber`}>{crewSize} {t('pirates', 'agents')}</span>
        </div>
        <input
          type="range"
          min={1}
          max={maxCrew}
          value={crewSize}
          onChange={e => handleCrewSizeChange(parseInt(e.target.value))}
          className="w-full accent-amber-500"
          disabled={reAnalyzing}
        />
        {reAnalyzing && (
          <div className="text-xs text-amber/60 text-center animate-pulse">{t('Re-consulting the stars...', 'Re-analyzing...')}</div>
        )}
      </div>

      {/* Repo paths */}
      {repos.length > 0 && (
        <div className="space-y-1.5 px-2">
          <span className="text-xs text-white/40">Detected Repos</span>
          {repos.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={r}
                onChange={e => setRepos(prev => prev.map((p, j) => j === i ? e.target.value : p))}
                className="flex-1 input-field-sm font-mono"
              />
            </div>
          ))}
        </div>
      )}

      {/* Crew manifest */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {crew.map((member, idx) => (
          <div key={idx} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{member.pirateIcon}</span>
              <div className="flex-1 min-w-0">
                {editingIdx === idx ? (
                  <input
                    value={member.pirateName}
                    onChange={e => updateCrewMember(idx, { pirateName: e.target.value })}
                    onBlur={() => setEditingIdx(null)}
                    onKeyDown={e => e.key === 'Enter' && setEditingIdx(null)}
                    className={`input-field-sm ${pirateFont} text-amber w-full`}
                    autoFocus
                  />
                ) : (
                  <span className={`${pirateFont} text-amber cursor-pointer hover:opacity-80`} onClick={() => setEditingIdx(idx)}>
                    {member.pirateName}
                  </span>
                )}
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/40" title={DOMAIN_TO_ROLE[member.domain] ?? member.domain}>
                <PT k={member.pirateRole} className="border-0" />
              </span>
              <span className="flex gap-0.5">{complexitySkulls(member.complexity)}</span>
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: member.pirateColor }}
              />
              <button onClick={() => rerollName(idx)} className="text-xs text-white/20 hover:text-amber transition-colors" title="Re-roll name">
                🎲
              </button>
              <button onClick={() => removeCrew(idx)} className="text-xs text-white/20 hover:text-red-400 transition-colors" title="Remove pirate">
                ✕
              </button>
            </div>

            <p className="text-xs text-white/50">{member.description}</p>

            {/* Tasks */}
            {member.tasks.length > 0 && (
              <div className="text-xs space-y-0.5 pl-2">
                {member.tasks.slice(0, 3).map((task, ti) => (
                  <div key={ti} className="text-white/30 flex items-start gap-1.5">
                    <span className="opacity-40 mt-0.5">•</span>
                    <span>{task}</span>
                  </div>
                ))}
                {member.tasks.length > 3 && (
                  <span className="text-white/15">+{member.tasks.length - 3} more</span>
                )}
              </div>
            )}

            {/* Dependencies */}
            {member.dependencies.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-white/25">
                <CrossedSwordsIcon size={10} />
                <span>Depends on: {member.dependencies.join(', ')}</span>
              </div>
            )}

            {/* Per-member repo override */}
            {repos.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/20 flex-shrink-0">Repo:</span>
                <select
                  value={member.repoPath ?? repos[0] ?? ''}
                  onChange={e => updateCrewMember(idx, { repoPath: e.target.value })}
                  className="flex-1 text-xs bg-white/[0.03] border border-white/[0.06] rounded px-2 py-1 text-white/60 outline-none"
                >
                  {repos.map((r, ri) => (
                    <option key={ri} value={r}>{r.replace(/\\/g, '/').split('/').pop() || r}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom actions */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-ghost">
          ← Back
        </button>
        <button onClick={addBlank} className="btn-ghost">
          + <PT k="Recruit" className="border-0" />
        </button>
        <button
          onClick={() => onSetSail(crew, repos)}
          disabled={crew.length === 0 || reAnalyzing}
          className={`flex-1 py-3 rounded-lg ${pirateFont} text-xl text-amber border-2 border-amber/40 bg-amber/10 hover:bg-amber/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all`}
        >
          <PT k="Set Sail" className="border-0" />
        </button>
      </div>
    </div>
  )
}
