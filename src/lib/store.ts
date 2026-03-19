import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

  // Live data
  git: GitInfo | null
  messages: AgentMessage[]
  isStreaming: boolean
}

interface Store {
  agents: Agent[]
  roadmap: string
  expandedId: string | null
  filter: string
  setupComplete: boolean

  // Actions
  addAgent: (config: Partial<Agent>) => void
  removeAgent: (id: string) => void
  updateAgent: (id: string, updates: Partial<Agent>) => void
  appendMessage: (id: string, msg: AgentMessage) => void
  setExpanded: (id: string | null) => void
  setFilter: (filter: string) => void
  setRoadmap: (content: string) => void
  setSetupComplete: (v: boolean) => void
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
    }),
    {
      name: 'fleet-store',
      partialize: (state) => ({
        agents: state.agents.map((a) => ({
          ...a,
          // Don't persist runtime-only state
          messages: a.messages.slice(-50),
          isStreaming: false,
          git: null,
        })),
        roadmap: state.roadmap,
        setupComplete: state.setupComplete,
      }),
    }
  )
)
