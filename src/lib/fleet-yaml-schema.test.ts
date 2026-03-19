import { describe, it, expect } from 'vitest'
import {
  AgentConfigSchema,
  ReactionConfigSchema,
  FleetYamlSchema,
} from './fleet-yaml-schema'

describe('AgentConfigSchema', () => {
  it('accepts a minimal valid agent (name + path only)', () => {
    const result = AgentConfigSchema.safeParse({ name: 'Frontend', path: '/tmp/fe' })
    expect(result.success).toBe(true)
  })

  it('accepts a fully-populated agent', () => {
    const result = AgentConfigSchema.safeParse({
      name: 'Frontend',
      path: '/tmp/fe',
      role: 'Build the UI',
      devPort: 3000,
      agentType: 'worker',
      icon: '⚙️',
      color: '#2563eb',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an agent missing name', () => {
    const result = AgentConfigSchema.safeParse({ path: '/tmp/fe' })
    expect(result.success).toBe(false)
  })

  it('rejects an agent missing path', () => {
    const result = AgentConfigSchema.safeParse({ name: 'Frontend' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid agentType', () => {
    const result = AgentConfigSchema.safeParse({ name: 'A', path: '/tmp', agentType: 'boss' })
    expect(result.success).toBe(false)
  })

  it('accepts agentType: quartermaster', () => {
    const result = AgentConfigSchema.safeParse({ name: 'QM', path: '/tmp', agentType: 'quartermaster' })
    expect(result.success).toBe(true)
  })
})

describe('ReactionConfigSchema', () => {
  it('accepts a valid file_change reaction', () => {
    const result = ReactionConfigSchema.safeParse({
      name: 'Test fix',
      trigger: { type: 'file_change', agent: 'Frontend', path: 'test-results' },
      action: { type: 'send_prompt', agent: 'Frontend', message: 'Fix tests' },
      cooldown: 300,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a port_unavailable reaction', () => {
    const result = ReactionConfigSchema.safeParse({
      name: 'Restart server',
      trigger: { type: 'port_unavailable', agent: 'Frontend', port: 3000 },
      action: { type: 'send_prompt', agent: 'Frontend', message: 'Restart dev server' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown trigger type', () => {
    const result = ReactionConfigSchema.safeParse({
      name: 'Bad',
      trigger: { type: 'disk_full', agent: 'Frontend' },
      action: { type: 'send_prompt', agent: 'Frontend', message: 'Fix it' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown action type', () => {
    const result = ReactionConfigSchema.safeParse({
      name: 'Bad',
      trigger: { type: 'file_change', agent: 'Frontend', path: 'foo' },
      action: { type: 'send_email', agent: 'Frontend' },
    })
    expect(result.success).toBe(false)
  })
})

describe('FleetYamlSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(FleetYamlSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a document with only agents', () => {
    const result = FleetYamlSchema.safeParse({
      agents: [{ name: 'Frontend', path: '/tmp/fe' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a document with only reactions', () => {
    const result = FleetYamlSchema.safeParse({
      reactions: [{
        name: 'Fix',
        trigger: { type: 'file_change', agent: 'A', path: 'foo' },
        action: { type: 'send_prompt', agent: 'A', message: 'Fix it' },
      }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects when an agent in the array is invalid', () => {
    const result = FleetYamlSchema.safeParse({
      agents: [{ path: '/tmp/fe' }],  // missing name
    })
    expect(result.success).toBe(false)
  })
})
