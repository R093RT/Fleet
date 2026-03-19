'use client'

import { useState, useEffect } from 'react'
import { useStore, type AgentConfig } from '@/lib/store'
import { AgentForm, type AgentFormValues } from './AgentForm'

export function SetupWizard() {
  const { addAgent, setSetupComplete, importAgentsFromConfig } = useStore()
  const [step, setStep] = useState<'welcome' | 'agent' | 'import' | null>(null)
  const [configAgents, setConfigAgents] = useState<AgentConfig[]>([])

  useEffect(() => {
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
  }, [])

  const handleSubmit = (v: AgentFormValues) => {
    const repo = v.path.replace(/\\/g, '/').split('/').pop() || v.name
    addAgent({ name: v.name, role: v.role, repo, path: v.path, icon: v.icon, color: v.color, devPort: v.devPort ? parseInt(v.devPort) : null })
    setSetupComplete(true)
  }

  if (step === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold opacity-40 animate-pulse mx-auto"
            style={{ background: 'linear-gradient(135deg, #1a2332, #d4a843)' }}>FL</div>
          <p className="text-xs opacity-20">Checking for fleet.yaml…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface">
      <div className="w-full max-w-lg px-6">

        {step === 'import' && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                  style={{ background: 'linear-gradient(135deg, #1a2332, #d4a843)' }}>FL</div>
                <div className="text-left">
                  <h1 className="text-2xl font-bold tracking-wide text-amber">FLEET</h1>
                  <p className="text-xs opacity-30">fleet.yaml config detected</p>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/6 rounded-xl p-4 space-y-2">
              <p className="text-xs opacity-40 mb-3">Agents to import:</p>
              {configAgents.map((a) => (
                <div key={a.name} className="flex items-center gap-2 text-sm">
                  <span>{a.icon ?? '⚙️'}</span>
                  <span className="font-medium">{a.name}</span>
                  {a.role && <span className="opacity-30 text-xs">— {a.role}</span>}
                  <span className="ml-auto text-xs opacity-20 font-mono truncate max-w-[180px]" title={a.path}>{a.path}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('agent')}
                className="flex-1 py-2 rounded-lg text-sm border border-white/8 text-white/40 hover:text-white/60 transition-all">
                Manual setup
              </button>
              <button
                onClick={() => importAgentsFromConfig(configAgents)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{ backgroundColor: 'rgba(212,168,67,0.15)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.25)' }}>
                Import {configAgents.length} agent{configAgents.length !== 1 ? 's' : ''} →
              </button>
            </div>
          </div>
        )}

        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                style={{ background: 'linear-gradient(135deg, #1a2332, #d4a843)' }}>FL</div>
              <div className="text-left">
                <h1 className="text-2xl font-bold tracking-wide text-amber">FLEET</h1>
                <p className="text-xs opacity-30">Claude Code agent command center</p>
              </div>
            </div>

            <div className="space-y-3 text-sm opacity-60 leading-relaxed text-left bg-white/[0.03] rounded-xl p-5 border border-white/6">
              <p>Fleet lets you run and coordinate multiple Claude Code agents across your local repos from a single dashboard.</p>
              <p>You can spawn agents, watch their terminal output live, review git diffs, approve plans, and send signals between agents.</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs opacity-30">Make sure you have Claude Code installed:</p>
              <code className="block text-xs bg-white/5 border border-white/8 rounded px-4 py-2 font-mono text-white/60">
                npm install -g @anthropic-ai/claude-code
              </code>
            </div>

            <button onClick={() => setStep('agent')}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{ backgroundColor: 'rgba(212,168,67,0.15)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.25)' }}>
              Get started →
            </button>
          </div>
        )}

        {step === 'agent' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('welcome')} className="text-xs opacity-30 hover:opacity-60">←</button>
              <div>
                <h2 className="text-sm font-semibold">Add your first agent</h2>
                <p className="text-xs opacity-30 mt-0.5">Point it at a local git repo</p>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/6 rounded-xl p-5">
              <AgentForm
                submitLabel="Launch Fleet →"
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
