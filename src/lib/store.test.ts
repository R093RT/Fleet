import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './store'
import type { Voyage } from './voyage'

// Reset store before each test
beforeEach(() => {
  useStore.setState({
    agents: [],
    roadmap: '',
    expandedId: null,
    filter: 'all',
    setupComplete: false,
    dailySpend: {},
    voyage: null,
    voyagePendingLaunch: [],
  })
})

describe('addAgent / makeAgent defaults', () => {
  it('initialises worktreePath to null', () => {
    useStore.getState().addAgent({ name: 'Test', path: '/tmp/test' })
    const agent = useStore.getState().agents.at(-1)
    expect(agent?.worktreePath).toBeNull()
  })

  it('initialises worktreeBranch to null', () => {
    useStore.getState().addAgent({ name: 'Test', path: '/tmp/test' })
    const agent = useStore.getState().agents.at(-1)
    expect(agent?.worktreeBranch).toBeNull()
  })

  it('initialises status to idle', () => {
    useStore.getState().addAgent({ name: 'Test', path: '/tmp/test' })
    const agent = useStore.getState().agents.at(-1)
    expect(agent?.status).toBe('idle')
  })

  it('initialises sessionId to null', () => {
    useStore.getState().addAgent({ name: 'Test', path: '/tmp/test' })
    const agent = useStore.getState().agents.at(-1)
    expect(agent?.sessionId).toBeNull()
  })

  it('initialises session stats to zero/null', () => {
    useStore.getState().addAgent({ name: 'Test', path: '/tmp/test' })
    const agent = useStore.getState().agents.at(-1)
    expect(agent?.sessionStartedAt).toBeNull()
    expect(agent?.sessionCost).toBe(0)
    expect(agent?.sessionTurns).toBe(0)
    expect(agent?.sessionTokens).toBeNull()
    expect(agent?.pid).toBeNull()
  })

  it('initialises auto-iterate config to defaults', () => {
    useStore.getState().addAgent({ name: 'Test', path: '/tmp/test' })
    const agent = useStore.getState().agents.at(-1)
    expect(agent?.autoIterate).toBe(false)
    expect(agent?.iterateThreshold).toBe(75)
    expect(agent?.iterateMaxRounds).toBe(3)
    expect(agent?.iterationRound).toBe(0)
    expect(agent?.iterationScore).toBeNull()
  })

  it('initialises agentType to worker', () => {
    useStore.getState().addAgent({ name: 'Test', path: '/tmp/test' })
    const agent = useStore.getState().agents.at(-1)
    expect(agent?.agentType).toBe('worker')
    expect(agent?.injectRoadmap).toBe(false)
  })

  it('respects agentType: quartermaster when provided', () => {
    useStore.getState().addAgent({ name: 'QM', path: '/tmp/test', agentType: 'quartermaster' })
    const agent = useStore.getState().agents.at(-1)
    expect(agent?.agentType).toBe('quartermaster')
  })

  it('initialises messages to empty array', () => {
    useStore.getState().addAgent({ name: 'Test', path: '/tmp/test' })
    const agent = useStore.getState().agents.at(-1)
    expect(agent?.messages).toEqual([])
  })

  it('uses provided name', () => {
    useStore.getState().addAgent({ name: 'My Agent', path: '/tmp/test' })
    const agent = useStore.getState().agents.at(-1)
    expect(agent?.name).toBe('My Agent')
  })
})

describe('appendMessage', () => {
  it('adds a message to the agent', () => {
    useStore.getState().addAgent({ name: 'A', path: '/tmp' })
    const id = useStore.getState().agents.at(-1)!.id
    useStore.getState().appendMessage(id, { id: 'm1', role: 'user', content: 'hello', timestamp: 1 })
    expect(useStore.getState().agents.at(-1)?.messages).toHaveLength(1)
  })

  it('keeps at most 200 messages (truncates oldest)', () => {
    useStore.getState().addAgent({ name: 'A', path: '/tmp' })
    const id = useStore.getState().agents.at(-1)!.id
    for (let i = 0; i < 210; i++) {
      useStore.getState().appendMessage(id, { id: `m${i}`, role: 'user', content: `msg ${i}`, timestamp: i })
    }
    expect(useStore.getState().agents.at(-1)?.messages.length).toBeLessThanOrEqual(201)
  })
})

describe('removeAgent', () => {
  it('removes the agent from the list', () => {
    useStore.getState().addAgent({ name: 'A', path: '/tmp' })
    const id = useStore.getState().agents.at(-1)!.id
    useStore.getState().removeAgent(id)
    expect(useStore.getState().agents.find((a) => a.id === id)).toBeUndefined()
  })

  it('clears expandedId when removing the expanded agent', () => {
    useStore.getState().addAgent({ name: 'A', path: '/tmp' })
    const id = useStore.getState().agents.at(-1)!.id
    useStore.getState().setExpanded(id)
    useStore.getState().removeAgent(id)
    expect(useStore.getState().expandedId).toBeNull()
  })

  it('keeps expandedId when removing a different agent', () => {
    useStore.getState().addAgent({ id: 'agent-a', name: 'A', path: '/tmp' })
    useStore.getState().addAgent({ id: 'agent-b', name: 'B', path: '/tmp' })
    useStore.getState().setExpanded('agent-b')
    useStore.getState().removeAgent('agent-a')
    expect(useStore.getState().expandedId).toBe('agent-b')
  })
})

describe('setSetupComplete', () => {
  it('updates setupComplete', () => {
    useStore.getState().setSetupComplete(true)
    expect(useStore.getState().setupComplete).toBe(true)
  })
})

describe('budgetCap + pendingTrigger defaults', () => {
  it('initialises budgetCap to null', () => {
    useStore.getState().addAgent({ name: 'Test', path: '/tmp/test' })
    const agent = useStore.getState().agents.at(-1)
    expect(agent?.budgetCap).toBeNull()
  })

  it('initialises pendingTrigger to null', () => {
    useStore.getState().addAgent({ name: 'Test', path: '/tmp/test' })
    const agent = useStore.getState().agents.at(-1)
    expect(agent?.pendingTrigger).toBeNull()
  })

  it('respects budgetCap when provided', () => {
    useStore.getState().addAgent({ name: 'Test', path: '/tmp/test', budgetCap: 1.5 })
    const agent = useStore.getState().agents.at(-1)
    expect(agent?.budgetCap).toBe(1.5)
  })
})

describe('importAgentsFromConfig', () => {
  it('creates agents from config and sets setupComplete', () => {
    useStore.getState().importAgentsFromConfig([
      { name: 'Frontend', path: '/tmp/fe' },
      { name: 'Backend', path: '/tmp/be' },
    ])
    const { agents, setupComplete } = useStore.getState()
    expect(agents).toHaveLength(2)
    expect(agents[0]?.name).toBe('Frontend')
    expect(agents[1]?.name).toBe('Backend')
    expect(setupComplete).toBe(true)
  })

  it('assigns unique IDs when importing multiple agents', () => {
    useStore.getState().importAgentsFromConfig([
      { name: 'A', path: '/tmp/a' },
      { name: 'B', path: '/tmp/b' },
      { name: 'C', path: '/tmp/c' },
    ])
    const ids = useStore.getState().agents.map(a => a.id)
    expect(new Set(ids).size).toBe(3)
  })

  it('derives repo from the last path segment', () => {
    useStore.getState().importAgentsFromConfig([{ name: 'Agent', path: '/home/user/my-project' }])
    expect(useStore.getState().agents[0]?.repo).toBe('my-project')
  })

  it('respects agentType from config', () => {
    useStore.getState().importAgentsFromConfig([{ name: 'QM', path: '/tmp/q', agentType: 'quartermaster' }])
    expect(useStore.getState().agents[0]?.agentType).toBe('quartermaster')
  })

  it('defaults agentType to worker when not specified', () => {
    useStore.getState().importAgentsFromConfig([{ name: 'W', path: '/tmp/w' }])
    expect(useStore.getState().agents[0]?.agentType).toBe('worker')
  })

  it('appends to existing agents rather than replacing them', () => {
    useStore.getState().addAgent({ name: 'Existing', path: '/tmp/e' })
    useStore.getState().importAgentsFromConfig([{ name: 'New', path: '/tmp/n' }])
    expect(useStore.getState().agents).toHaveLength(2)
  })
})

describe('addDailySpend', () => {
  it('creates a new date entry', () => {
    useStore.getState().addDailySpend('2026-03-19', 0.0123)
    expect(useStore.getState().dailySpend['2026-03-19']).toBeCloseTo(0.0123)
  })

  it('accumulates multiple calls on the same date', () => {
    useStore.getState().addDailySpend('2026-03-19', 0.01)
    useStore.getState().addDailySpend('2026-03-19', 0.02)
    expect(useStore.getState().dailySpend['2026-03-19']).toBeCloseTo(0.03)
  })

  it('keeps separate entries for different dates', () => {
    useStore.getState().addDailySpend('2026-03-18', 0.5)
    useStore.getState().addDailySpend('2026-03-19', 0.1)
    expect(useStore.getState().dailySpend['2026-03-18']).toBeCloseTo(0.5)
    expect(useStore.getState().dailySpend['2026-03-19']).toBeCloseTo(0.1)
  })
})

describe('setVoyage', () => {
  const makeVoyage = (overrides: Partial<Voyage> = {}): Voyage => ({
    id: 'voyage-1',
    name: 'Test Voyage',
    treasureMap: '# My Roadmap',
    tasks: [
      { id: 'task-1', name: 'Build UI', agentId: 'agent-a', completed: false },
      { id: 'task-2', name: 'Build API', agentId: 'agent-b', completed: false },
    ],
    repos: ['/tmp/repo'],
    startedAt: Date.now(),
    ...overrides,
  })

  it('sets the voyage', () => {
    const voyage = makeVoyage()
    useStore.getState().setVoyage(voyage)
    expect(useStore.getState().voyage).toEqual(voyage)
  })

  it('clears the voyage when set to null', () => {
    useStore.getState().setVoyage(makeVoyage())
    useStore.getState().setVoyage(null)
    expect(useStore.getState().voyage).toBeNull()
  })

  it('replaces an existing voyage', () => {
    useStore.getState().setVoyage(makeVoyage({ name: 'First' }))
    useStore.getState().setVoyage(makeVoyage({ name: 'Second' }))
    expect(useStore.getState().voyage?.name).toBe('Second')
  })
})

describe('completeVoyageTask', () => {
  it('marks a task as completed', () => {
    useStore.getState().setVoyage({
      id: 'v1',
      name: 'V',
      treasureMap: '',
      tasks: [
        { id: 't1', name: 'Task 1', agentId: 'a1', completed: false },
        { id: 't2', name: 'Task 2', agentId: 'a2', completed: false },
      ],
      repos: [],
      startedAt: Date.now(),
    })

    useStore.getState().completeVoyageTask('t1')
    const tasks = useStore.getState().voyage!.tasks
    expect(tasks.find(t => t.id === 't1')?.completed).toBe(true)
    expect(tasks.find(t => t.id === 't1')?.completedAt).toBeDefined()
  })

  it('does not affect other tasks', () => {
    useStore.getState().setVoyage({
      id: 'v1',
      name: 'V',
      treasureMap: '',
      tasks: [
        { id: 't1', name: 'Task 1', agentId: 'a1', completed: false },
        { id: 't2', name: 'Task 2', agentId: 'a2', completed: false },
      ],
      repos: [],
      startedAt: Date.now(),
    })

    useStore.getState().completeVoyageTask('t1')
    expect(useStore.getState().voyage!.tasks.find(t => t.id === 't2')?.completed).toBe(false)
  })

  it('is a no-op when voyage is null', () => {
    // Should not throw
    useStore.getState().completeVoyageTask('t1')
    expect(useStore.getState().voyage).toBeNull()
  })

  it('is a no-op for non-existent task IDs', () => {
    useStore.getState().setVoyage({
      id: 'v1',
      name: 'V',
      treasureMap: '',
      tasks: [{ id: 't1', name: 'Task 1', agentId: 'a1', completed: false }],
      repos: [],
      startedAt: Date.now(),
    })

    useStore.getState().completeVoyageTask('nonexistent')
    expect(useStore.getState().voyage!.tasks[0]?.completed).toBe(false)
  })
})

describe('setVoyagePendingLaunch', () => {
  it('sets the pending launch list', () => {
    useStore.getState().setVoyagePendingLaunch(['agent-1', 'agent-2'])
    expect(useStore.getState().voyagePendingLaunch).toEqual(['agent-1', 'agent-2'])
  })

  it('clears the list when set to empty array', () => {
    useStore.getState().setVoyagePendingLaunch(['agent-1'])
    useStore.getState().setVoyagePendingLaunch([])
    expect(useStore.getState().voyagePendingLaunch).toEqual([])
  })

  it('replaces the previous list entirely', () => {
    useStore.getState().setVoyagePendingLaunch(['agent-1', 'agent-2'])
    useStore.getState().setVoyagePendingLaunch(['agent-3'])
    expect(useStore.getState().voyagePendingLaunch).toEqual(['agent-3'])
  })
})

describe('setPirateMode', () => {
  it('defaults pirateMode to true', () => {
    expect(useStore.getState().pirateMode).toBe(true)
  })

  it('defaults pirateModeChosen to false', () => {
    expect(useStore.getState().pirateModeChosen).toBe(false)
  })

  it('sets pirateMode and marks pirateModeChosen', () => {
    useStore.getState().setPirateMode(false)
    expect(useStore.getState().pirateMode).toBe(false)
    expect(useStore.getState().pirateModeChosen).toBe(true)
  })

  it('can toggle back to true', () => {
    useStore.getState().setPirateMode(false)
    useStore.getState().setPirateMode(true)
    expect(useStore.getState().pirateMode).toBe(true)
    expect(useStore.getState().pirateModeChosen).toBe(true)
  })
})
