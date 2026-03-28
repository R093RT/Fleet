'use client'

import { useState, useEffect } from 'react'
import { useStore, type AgentConfig } from '@/lib/store'
import { AgentForm, type AgentFormValues } from './AgentForm'
import { TreasureMapUpload } from './TreasureMapUpload'
import { CrewFormation } from './CrewFormation'
import { CompassRose, AnchorIcon } from './PirateDecorations'
import { PT } from './PirateTerm'
import { usePirateMode, usePirateClass, usePirateText } from '@/hooks/usePirateMode'
import { assignPirateIdentities } from '@/lib/pirate-names'
import type { PirateAssignment } from '@/lib/pirate-names'
import type { AnalysisResult } from '@/app/api/analyze-roadmap/route'

type Step = 'pirate-question' | 'welcome' | 'treasure-map' | 'charting' | 'crew' | 'agent' | 'import'

const CHARTING_MESSAGES_PIRATE = [
  'Consulting the stars...',
  'Reading the winds...',
  'Charting the course...',
  'Plotting waypoints...',
  'Scouting the seas...',
]

const CHARTING_MESSAGES_NORMAL = [
  'Analyzing roadmap...',
  'Reading input...',
  'Planning workstreams...',
  'Identifying tasks...',
  'Scanning repositories...',
]

function StepDots({ current, steps }: { current: Step; steps: Step[] }) {
  return (
    <div className="flex justify-center gap-2 mb-6">
      {steps.map(s => (
        <div key={s} className={`h-2 rounded-full transition-all duration-200 ${
          current === s ? 'bg-amber w-4' : 'bg-white/10 w-2'
        }`} />
      ))}
    </div>
  )
}

export function SetupWizard() {
  const { addAgent, setSetupComplete, importAgentsFromConfig, setRoadmap, setVoyage, setVoyagePendingLaunch, setPirateMode } = useStore()
  const pirateModeChosen = useStore(s => s.pirateModeChosen)
  const isPirate = usePirateMode()
  const pirateFont = usePirateClass()
  const t = usePirateText()
  const [step, setStep] = useState<Step | null>(null)
  const [configAgents, setConfigAgents] = useState<AgentConfig[]>([])
  const [treasureMap, setTreasureMap] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [chartingMsg, setChartingMsg] = useState(0)
  const [chartError, setChartError] = useState('')

  const chartingMessages = isPirate ? CHARTING_MESSAGES_PIRATE : CHARTING_MESSAGES_NORMAL

  // Check for fleet.yaml on mount
  useEffect(() => {
    if (!pirateModeChosen) {
      setStep('pirate-question')
      return
    }
    fetch('/api/fleet-config')
      .then(r => r.json())
      .then((data: { agents?: AgentConfig[] }) => {
        if (data.agents && data.agents.length > 0) {
          setConfigAgents(data.agents)
          setStep('import')
        } else {
          setStep('welcome')
        }
      })
      .catch(() => setStep('welcome'))
  }, [pirateModeChosen])

  // Rotate charting messages
  useEffect(() => {
    if (step !== 'charting') return
    const interval = setInterval(() => {
      setChartingMsg(i => (i + 1) % chartingMessages.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [step, chartingMessages.length])

  const handlePirateChoice = (choice: boolean) => {
    setPirateMode(choice)
    // Now check for fleet.yaml
    fetch('/api/fleet-config')
      .then(r => r.json())
      .then((data: { agents?: AgentConfig[] }) => {
        if (data.agents && data.agents.length > 0) {
          setConfigAgents(data.agents)
          setStep('import')
        } else {
          setStep('welcome')
        }
      })
      .catch(() => setStep('welcome'))
  }

  const handleTreasureMap = async (content: string, repos: string[]) => {
    setTreasureMap(content)
    setStep('charting')
    setChartError('')

    try {
      const res = await fetch('/api/analyze-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roadmap: content }),
      })
      const data = await res.json() as AnalysisResult & { error?: string }
      if (data.error) {
        setChartError(typeof data.error === 'string' ? data.error : JSON.stringify(data.error))
        setStep('treasure-map')
        return
      }
      // Merge user-provided repos with detected ones
      if (repos.length > 0) {
        const combined = [...new Set([...repos, ...data.repos])]
        data.repos = combined
      }
      setAnalysis(data)
      setStep('crew')
    } catch (e: unknown) {
      setChartError(e instanceof Error ? e.message : String(e))
      setStep('treasure-map')
    }
  }

  const handleSetSail = (crew: PirateAssignment[], repos: string[]) => {
    // Save treasure map as roadmap
    setRoadmap(treasureMap)

    // Save to disk too
    void fetch('/api/roadmap', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: treasureMap }),
    })

    // Create agents from crew
    const agentIds: string[] = []
    const voyageTasks: { id: string; name: string; agentId: string; completed: boolean }[] = []

    // Build a workstream-name → pirate-name map for dependency resolution
    const nameMap = new Map<string, string>()
    for (const member of crew) {
      nameMap.set(member.name, member.pirateName)
    }

    // Auto-match crew members to repos by domain/name keywords
    const matchRepo = (member: PirateAssignment): string => {
      if (member.repoPath) return member.repoPath
      // Try to match domain/name/description against repo folder names
      const keywords = [member.name, member.domain, member.description].join(' ').toLowerCase()
      for (const r of repos) {
        const folder = r.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? ''
        // Match common project name patterns
        if (folder && (keywords.includes(folder) ||
          (folder.includes('carbon') && keywords.includes('carbon')) ||
          (folder.includes('survey') && keywords.includes('survey')) ||
          (folder.includes('core') && keywords.includes('core')) ||
          (folder.includes('marketing') && keywords.includes('marketing')) ||
          (folder.includes('rubber') && (keywords.includes('core') || keywords.includes('dds'))) ||
          (folder.includes('app') && keywords.includes('survey'))
        )) {
          return r
        }
      }
      return repos[0] ?? ''
    }

    for (const member of crew) {
      const agentId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      agentIds.push(agentId)

      const repoPath = matchRepo(member)
      const repo = repoPath.replace(/\\/g, '/').split('/').pop() || member.pirateName

      // Build task description with dependency info
      let taskDesc = member.description
      if (member.dependencies.length > 0) {
        const depNames = member.dependencies
          .map(d => nameMap.get(d) ?? d)
          .join(', ')
        taskDesc += `\n[DEPENDENCIES: Wait for signals from ${depNames} before starting dependent work]`
      }
      if (member.territory.length > 0) {
        taskDesc += `\n[TERRITORY: ${member.territory.join(', ')}]`
      }

      // Derive per-agent budget: dailyBudgetCap / crew size (if set)
      const { dailyBudgetCap } = useStore.getState()
      const defaultAgentBudget = dailyBudgetCap != null && crew.length > 0
        ? Math.round((dailyBudgetCap / crew.length) * 100) / 100
        : null

      addAgent({
        id: agentId,
        name: member.pirateName,
        role: member.pirateRole,
        repo,
        path: repoPath,
        icon: member.pirateIcon,
        color: member.pirateColor,
        agentType: 'worker',
        task: taskDesc,
        budgetCap: defaultAgentBudget,
      })

      // Create voyage tasks from this crew member's tasks
      for (const task of member.tasks) {
        voyageTasks.push({
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: task,
          agentId,
          completed: false,
        })
      }
    }

    // Create the voyage
    setVoyage({
      id: `voyage-${Date.now()}`,
      name: analysis?.summary ?? 'New Voyage',
      treasureMap,
      tasks: voyageTasks,
      repos,
      startedAt: Date.now(),
    })

    // Queue all agents for auto-launch
    setVoyagePendingLaunch(agentIds)
    setSetupComplete(true)
  }

  const handleManualAgent = (v: AgentFormValues) => {
    const repo = v.path.replace(/\\/g, '/').split('/').pop() || v.name
    addAgent({ name: v.name, role: v.role, repo, path: v.path, icon: v.icon, color: v.color, devPort: v.devPort ? parseInt(v.devPort) : null })
    setSetupComplete(true)
  }

  // Loading state
  if (step === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface">
        <div className="text-center space-y-3">
          {isPirate ? <AnchorIcon size={32} className="opacity-40 animate-pulse mx-auto text-amber" /> : <span className="text-2xl animate-pulse">⚡</span>}
          <p className="text-xs opacity-20">{t('Checking for crew manifest…', 'Loading configuration…')}</p>
        </div>
      </div>
    )
  }

  const mainSteps: Step[] = ['welcome', 'treasure-map', 'crew']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface overflow-y-auto">
      {/* Compass watermark — pirate mode only */}
      {isPirate && <CompassRose size={400} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber opacity-[0.02] pointer-events-none" />}

      {/* Decorative glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-[0.04] pointer-events-none"
        style={{ background: isPirate ? 'radial-gradient(ellipse, #d4a843, transparent 70%)' : 'radial-gradient(ellipse, #3b82f6, transparent 70%)' }} />

      <div className={`w-full px-6 relative ${step === 'crew' ? 'max-w-[1600px] py-6' : 'max-w-xl py-12'}`}>

        {/* Pirate question — first-time only */}
        {step === 'pirate-question' && (
          <div className="text-center space-y-10 animate-fade-in">
            {/* Logo */}
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                style={{ background: 'linear-gradient(135deg, #1a2332, #d4a843)' }}>
                <AnchorIcon size={32} className="text-white/90" />
              </div>
              <h1 className="text-4xl font-bold tracking-widest text-amber">FLEET</h1>
              <p className="text-sm text-white/60">Multi-agent command center for Claude Code</p>
            </div>

            <div className="space-y-2">
              <p className="text-base text-white/80">How would you like your dashboard?</p>
            </div>

            <div className="grid grid-cols-2 gap-5 max-w-xl mx-auto">
              {/* Pirate option */}
              <button
                onClick={() => handlePirateChoice(true)}
                className="group relative p-6 rounded-2xl border border-amber/20 bg-amber/[0.03] hover:bg-amber/[0.08] hover:border-amber/50 hover:scale-[1.02] transition-all duration-200 text-left space-y-4 overflow-hidden"
              >
                {/* Glow effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: 'radial-gradient(circle at 50% 80%, rgba(212,168,67,0.08), transparent 70%)' }} />
                <div className="text-4xl relative">🏴‍☠️</div>
                <div className="relative">
                  <div className="font-pirate text-amber text-lg">Pirate Mode</div>
                  <div className="text-sm text-white/50 mt-1.5 leading-relaxed">
                    Nautical theme with swashbuckling terminology and pirate flair
                  </div>
                </div>
                <div className="relative text-xs text-white/40 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 font-mono italic leading-relaxed">
                  &ldquo;Oh Captain, my Captain! Yer crew be at sea...&rdquo;
                </div>
              </button>

              {/* Professional option */}
              <button
                onClick={() => handlePirateChoice(false)}
                className="group relative p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-blue-500/30 hover:scale-[1.02] transition-all duration-200 text-left space-y-4 overflow-hidden"
              >
                {/* Glow effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: 'radial-gradient(circle at 50% 80%, rgba(59,130,246,0.06), transparent 70%)' }} />
                <div className="text-4xl relative">⚡</div>
                <div className="relative">
                  <div className="font-medium text-white/80 text-lg">Professional</div>
                  <div className="text-sm text-white/50 mt-1.5 leading-relaxed">
                    Clean interface with standard developer terminology
                  </div>
                </div>
                <div className="relative text-xs text-white/40 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 font-mono italic leading-relaxed">
                  &ldquo;Welcome! Your agents are running...&rdquo;
                </div>
              </button>
            </div>

            <p className="text-xs text-white/40 flex items-center justify-center gap-1.5">
              <span className="inline-block w-4 h-px bg-white/10" />
              You can switch anytime from the header toggle
              <span className="inline-block w-4 h-px bg-white/10" />
            </p>
          </div>
        )}

        {/* Import from fleet.yaml */}
        {step === 'import' && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-3">
                {isPirate ? <AnchorIcon size={36} className="text-amber" /> : <span className="text-3xl">⚡</span>}
                <div className="text-left">
                  <h1 className={`text-2xl ${pirateFont} tracking-wide text-amber`}>FLEET</h1>
                  <p className={`text-xs opacity-30 ${pirateFont}`}>Existing <PT k="Crew Manifest" className="border-0" /> found</p>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-2 shadow-lg shadow-black/20">
              <p className="text-xs opacity-40 mb-3">{t('Pirates to recruit:', 'Agents to add:')}</p>
              {configAgents.map((a) => (
                <div key={a.name} className="flex items-center gap-2 text-sm">
                  <span>{a.icon ?? '⚙️'}</span>
                  <span className={`${pirateFont} text-amber`}>{a.name}</span>
                  {a.role && <span className="opacity-30 text-xs">— {a.role}</span>}
                  <span className="ml-auto text-xs opacity-20 font-mono truncate max-w-[180px]" title={a.path}>{a.path}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('welcome')}
                className="btn-ghost flex-1 py-2">
                {t('Chart a new course', 'Start fresh')}
              </button>
              <button
                onClick={() => importAgentsFromConfig(configAgents)}
                className={`btn-primary flex-1 py-2.5 ${pirateFont}`}>
                <PT k="Recruit" className="border-0" /> {configAgents.length} {t(`pirate${configAgents.length !== 1 ? 's' : ''}`, `agent${configAgents.length !== 1 ? 's' : ''}`)} →
              </button>
            </div>
          </div>
        )}

        {/* Welcome */}
        {step === 'welcome' && (
          <div className="text-center space-y-6 animate-fade-in">
            <StepDots current="welcome" steps={mainSteps} />

            <div className="flex items-center justify-center gap-3">
              {isPirate ? <AnchorIcon size={36} className="text-amber" /> : <span className="text-3xl">⚡</span>}
              <div className="text-left">
                <h1 className={`text-2xl ${pirateFont} tracking-wide text-amber`}>FLEET</h1>
                <p className={`text-xs opacity-30 ${pirateFont}`}><PT k="Captain's Quarters" className="border-0" /></p>
              </div>
            </div>

            <div className="space-y-3 text-sm opacity-60 leading-relaxed text-left bg-white/[0.03] rounded-xl p-5 border border-white/[0.08] shadow-lg shadow-black/20">
              <p className={`${pirateFont} text-amber text-base`}>{t('Oh Captain, my Captain!', 'Welcome to Fleet!')}</p>
              <p>{t(
                'Fleet lets ye command a crew of Claude Code pirates across yer local repos from a single quarterdeck.',
                'Fleet lets you coordinate multiple Claude Code agents across your local repos from a single dashboard.'
              )}</p>
              <p>{t(
                <>Drop yer <PT k="Treasure Map" /> (project roadmap) and we&apos;ll form the perfect crew to plunder it.</>,
                <>Drop your project roadmap and we&apos;ll form the optimal team to tackle it.</>
              )}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs opacity-30">{t('Make sure ye have Claude Code installed:', 'Make sure you have Claude Code installed:')}</p>
              <code className="block text-xs bg-white/[0.04] border border-white/[0.08] rounded-md px-4 py-2 font-mono text-white/60">
                npm install -g @anthropic-ai/claude-code
              </code>
            </div>

            <div className="space-y-2">
              <button onClick={() => setStep('treasure-map')}
                className={`w-full py-3 rounded-lg ${pirateFont} text-lg text-amber border border-amber/30 bg-amber/5 hover:bg-amber/10 transition-all`}>
                {t(
                  <>Drop the <PT k="Treasure Map" className="border-0" /> →</>,
                  <>Drop your Project Roadmap →</>
                )}
              </button>
              <button onClick={() => setStep('agent')}
                className="btn-ghost w-full text-xs py-2 opacity-40">
                {t('Manual recruitment (add one pirate)', 'Manual setup (add one agent)')}
              </button>
            </div>
          </div>
        )}

        {/* Treasure Map Upload */}
        {step === 'treasure-map' && (
          <div className="space-y-5 animate-fade-in">
            <StepDots current="treasure-map" steps={mainSteps} />

            <div className="flex items-center gap-3">
              <button onClick={() => setStep('welcome')} className="text-xs opacity-30 hover:opacity-60 transition-opacity">←</button>
              <div>
                <h2 className={`text-sm ${pirateFont} text-amber`}><PT k="Treasure Map" /></h2>
                <p className="text-xs opacity-30 mt-0.5">{t("Drop yer project roadmap — we'll chart the course", "Drop your project roadmap — we'll analyze it")}</p>
              </div>
            </div>

            {chartError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                {chartError}
              </div>
            )}

            <TreasureMapUpload onSubmit={handleTreasureMap} />
          </div>
        )}

        {/* Charting / Loading */}
        {step === 'charting' && (
          <div className="text-center space-y-6 animate-fade-in">
            <CompassRose size={64} className="mx-auto text-amber animate-spin-slow" />
            <h2 className={`${pirateFont} text-xl text-amber`}>{chartingMessages[chartingMsg]}</h2>
            <p className="text-xs text-white/30">{t('Analyzing yer treasure map and forming the optimal crew...', 'Analyzing your roadmap and forming the optimal team...')}</p>
            <div className="w-48 h-1 mx-auto bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-amber/30 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* Crew Formation */}
        {step === 'crew' && analysis && (
          <div className="space-y-5 animate-fade-in">
            <StepDots current="crew" steps={mainSteps} />
            <CrewFormation
              analysis={analysis}
              treasureMap={treasureMap}
              onSetSail={handleSetSail}
              onBack={() => setStep('treasure-map')}
            />
          </div>
        )}

        {/* Manual agent (fallback) */}
        {step === 'agent' && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('welcome')} className="text-xs opacity-30 hover:opacity-60 transition-opacity">←</button>
              <div>
                <h2 className={`text-sm ${pirateFont} text-amber`}>{t(<><PT k="Recruit" /> yer first pirate</>, <>Add your first agent</>)}</h2>
                <p className="text-xs opacity-30 mt-0.5">Point them at a local git repo</p>
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 shadow-lg shadow-black/20">
              <AgentForm
                submitLabel={t('Recruit & Set Sail →', 'Add & Launch →')}
                onSubmit={handleManualAgent}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
