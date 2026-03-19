import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './store'

// Reset store before each test
beforeEach(() => {
  useStore.setState({
    agents: [],
    roadmap: '',
    expandedId: null,
    filter: 'all',
    setupComplete: false,
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
