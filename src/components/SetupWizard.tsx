'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { AgentForm, type AgentFormValues } from './AgentForm'

export function SetupWizard() {
  const { addAgent, setSetupComplete } = useStore()
  const [step, setStep] = useState<'welcome' | 'agent'>('welcome')

  const handleSubmit = (v: AgentFormValues) => {
    const repo = v.path.replace(/\\/g, '/').split('/').pop() || v.name
    addAgent({ name: v.name, role: v.role, repo, path: v.path, icon: v.icon, color: v.color, devPort: v.devPort ? parseInt(v.devPort) : null })
    setSetupComplete(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface">
      <div className="w-full max-w-lg px-6">

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
