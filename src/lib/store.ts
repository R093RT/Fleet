import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { z } from 'zod'
import type { AgentConfigSchema } from './fleet-yaml-schema'
import type { Voyage, VoyageTask } from './voyage'

export type AgentStatus = 'idle' | 'running' | 'needs-input' | 'reviewing' | 'done' | 'error'

export interface GitInfo {
  branch: string
  uncommitted: number
  unpushed: number
  lastCommit: string
  lastCommitTime: string
}

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface Agent {
  id: string
  name: string
  role: string
  repo: string
  path: string
  color: string
  icon: string
  devPort: number | null
  previewPath: string
  worktreePath: string | null
  worktreeBranch: string | null

  // Runtime state
  status: AgentStatus
  task: string
  score: number | null
  notes: string
  plan: string
  planApproved: boolean | null
  lastUpdate: number | null
  sessionId: string | null

  // Session stats (persisted — survive browser refresh)
  sessionStartedAt: number | null
  sessionCost: number
  sessionTurns: number
  sessionTokens: number | null

  // Score-driven iteration config (persisted)
  autoIterate: boolean
  iterateThreshold: number
  iterateMaxRounds: number

  // Agent type + roadmap/vault config (persisted)
  agentType: 'worker' | 'quartermaster'
  injectRoadmap: boolean
  injectVault: boolean

  // Budget (persisted)
  budgetCap: number | null

  // Live data (not persisted)
  pid: number | null
  iterationRound: number
  iterationScore: number | null
  pendingTrigger: string | null
  git: GitInfo | null
  messages: AgentMessage[]
  isStreaming: boolean
}

export type AgentConfig = z.infer<typeof AgentConfigSchema>

interface Store {
  agents: Agent[]
  roadmap: string
  expandedId: string | null
  filter: string
  setupComplete: boolean
  dailySpend: Record<string, number>
  dailyBudgetCap: number | null
  voyage: Voyage | null
  voyagePendingLaunch: string[]
  pirateMode: boolean
  pirateModeChosen: boolean

  // Actions
  addAgent: (config: Partial<Agent>) => void
  removeAgent: (id: string) => void
  updateAgent: (id: string, updates: Partial<Agent>) => void
  appendMessage: (id: string, msg: AgentMessage) => void
  setExpanded: (id: string | null) => void
  setFilter: (filter: string) => void
  setRoadmap: (content: string) => void
  setSetupComplete: (v: boolean) => void
  addDailySpend: (date: string, amount: number) => void
  setDailyBudgetCap: (cap: number | null) => void
  importAgentsFromConfig: (configs: AgentConfig[]) => void
  setVoyage: (v: Voyage | null) => void
  toggleVoyageTask: (taskId: string) => void
  setVoyagePendingLaunch: (ids: string[]) => void
  setPirateMode: (v: boolean) => void
}

const makeAgent = (config: Partial<Agent>): Agent => ({
  id: config.id || `agent-${Date.now()}`,
  name: config.name || 'New Agent',
  role: config.role || '',
  repo: config.repo || '',
  path: config.path || '',
  color: config.color || '#2563eb',
  icon: config.icon || '⚙️',
  devPort: config.devPort ?? null,
  previewPath: config.previewPath || '/',
  worktreePath: config.worktreePath ?? null,
  worktreeBranch: config.worktreeBranch ?? null,
  status: 'idle',
  task: config.task || '',
  score: null,
  notes: '',
  plan: '',
  planApproved: null,
  lastUpdate: null,
  sessionId: null,
  sessionStartedAt: null,
  sessionCost: 0,
  sessionTurns: 0,
  sessionTokens: null,
  autoIterate: false,
  iterateThreshold: 75,
  iterateMaxRounds: 3,
  agentType: config.agentType ?? 'worker',
  injectRoadmap: config.injectRoadmap ?? false,
  injectVault: config.injectVault ?? false,
  budgetCap: config.budgetCap ?? null,
  pid: null,
  iterationRound: 0,
  iterationScore: null,
  pendingTrigger: null,
  git: null,
  messages: [],
  isStreaming: false,
})

export const useStore = create<Store>()(
  persist(
    (set) => ({
      agents: [],
      roadmap: '',
      expandedId: null,
      filter: 'all',
      setupComplete: false,
      dailySpend: {},
      dailyBudgetCap: null,
      voyage: null,
      voyagePendingLaunch: [],
      pirateMode: true,
      pirateModeChosen: false,

      addAgent: (config) =>
        set((s) => ({ agents: [...s.agents, makeAgent(config)] })),

      removeAgent: (id) =>
        set((s) => ({
          agents: s.agents.filter((a) => a.id !== id),
          expandedId: s.expandedId === id ? null : s.expandedId,
        })),

      updateAgent: (id, updates) =>
        set((s) => ({
          agents: s.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),

      appendMessage: (id, msg) =>
        set((s) => ({
          agents: s.agents.map((a) =>
            a.id === id ? { ...a, messages: [...a.messages.slice(-200), msg] } : a
          ),
        })),

      setExpanded: (id) => set({ expandedId: id }),
      setFilter: (filter) => set({ filter }),
      setRoadmap: (roadmap) => set({ roadmap }),
      setSetupComplete: (v) => set({ setupComplete: v }),
      addDailySpend: (date, amount) =>
        set((s) => {
          const updated = { ...s.dailySpend, [date]: (s.dailySpend[date] ?? 0) + amount }
          const keys = Object.keys(updated).sort()
          if (keys.length > 30) {
            const pruned: Record<string, number> = {}
            for (const k of keys.slice(-30)) pruned[k] = updated[k] ?? 0
            return { dailySpend: pruned }
          }
          return { dailySpend: updated }
        }),

      setDailyBudgetCap: (cap) => set({ dailyBudgetCap: cap }),

      importAgentsFromConfig: (configs) =>
        set((s) => {
          const now = Date.now()
          const newAgents = configs.map((c, i) =>
            makeAgent({
              id: `agent-${now}-${i}`,
              name: c.name,
              path: c.path,
              role: c.role,
              devPort: c.devPort ?? null,
              agentType: c.agentType ?? 'worker',
              icon: c.icon,
              color: c.color,
              repo: c.path.replace(/\\/g, '/').split('/').pop() || c.name,
            })
          )
          return { agents: [...s.agents, ...newAgents], setupComplete: true }
        }),

      setVoyage: (v) => set({ voyage: v }),
      toggleVoyageTask: (taskId) => set((s) => {
        if (!s.voyage) return {}
        return {
          voyage: {
            ...s.voyage,
            tasks: s.voyage.tasks.map(t => {
              if (t.id !== taskId) return t
              return t.completed
                ? { ...t, completed: false, completedAt: undefined }
                : { ...t, completed: true, completedAt: Date.now() }
            }),
          },
        }
      }),
      setVoyagePendingLaunch: (ids) => set({ voyagePendingLaunch: ids }),
      setPirateMode: (v) => set({ pirateMode: v, pirateModeChosen: true }),
    }),
    {
      name: 'fleet-store',
      partialize: (state) => ({
        agents: state.agents.map((a) => ({
          ...a,
          // Don't persist runtime-only state
          messages: a.messages.slice(-50),
          isStreaming: false,
          pid: null,
          iterationRound: 0,
          iterationScore: null,
          pendingTrigger: null,
          git: null,
        })),
        roadmap: state.roadmap,
        setupComplete: state.setupComplete,
        dailySpend: state.dailySpend,
        dailyBudgetCap: state.dailyBudgetCap,
        voyage: state.voyage,
        voyagePendingLaunch: [],
        pirateMode: state.pirateMode,
        pirateModeChosen: state.pirateModeChosen,
      }),
    }
  )
)
