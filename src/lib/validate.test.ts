import { describe, it, expect } from 'vitest'
import { SafeId, SafeSessionId, SafeTool } from './validate'

describe('SafeId', () => {
  it('accepts typical agent IDs', () => {
    expect(SafeId.safeParse('agent-1234567890').success).toBe(true)
    expect(SafeId.safeParse('agent-1234567890-0').success).toBe(true)
    expect(SafeId.safeParse('frontend').success).toBe(true)
    expect(SafeId.safeParse('my_agent_01').success).toBe(true)
  })

  it('rejects empty string', () => {
    expect(SafeId.safeParse('').success).toBe(false)
  })

  it('rejects path traversal attempts', () => {
    expect(SafeId.safeParse('../etc/passwd').success).toBe(false)
    expect(SafeId.safeParse('../../secret').success).toBe(false)
    expect(SafeId.safeParse('agent/../../etc').success).toBe(false)
  })

  it('rejects shell metacharacters', () => {
    expect(SafeId.safeParse('agent; rm -rf /').success).toBe(false)
    expect(SafeId.safeParse('agent`whoami`').success).toBe(false)
    expect(SafeId.safeParse('agent$(id)').success).toBe(false)
    expect(SafeId.safeParse('agent\ninjection').success).toBe(false)
  })

  it('rejects IDs exceeding 128 characters', () => {
    expect(SafeId.safeParse('a'.repeat(129)).success).toBe(false)
  })
})

describe('SafeSessionId', () => {
  it('accepts typical Claude session IDs', () => {
    expect(SafeSessionId.safeParse('abc123-def456').success).toBe(true)
    expect(SafeSessionId.safeParse('session/sub-path_01').success).toBe(true)
  })

  it('rejects empty string', () => {
    expect(SafeSessionId.safeParse('').success).toBe(false)
  })

  it('rejects shell metacharacters', () => {
    expect(SafeSessionId.safeParse('test; whoami').success).toBe(false)
    expect(SafeSessionId.safeParse('id\ninjection').success).toBe(false)
    expect(SafeSessionId.safeParse('$(cmd)').success).toBe(false)
  })

  it('rejects IDs exceeding 256 characters', () => {
    expect(SafeSessionId.safeParse('a'.repeat(257)).success).toBe(false)
  })
})

describe('SafeTool', () => {
  it('accepts all default allowed tools', () => {
    const validTools = [
      'Read', 'Write', 'Edit',
      'Bash(npm run *)', 'Bash(npx *)', 'Bash(node *)',
      'Bash(git add *)', 'Bash(git commit *)', 'Bash(git status)',
      'Bash(cat *)', 'Bash(ls *)', 'Bash(grep *)',
    ]
    for (const t of validTools) {
      expect(SafeTool.safeParse(t).success).toBe(true)
    }
  })

  it('rejects empty string', () => {
    expect(SafeTool.safeParse('').success).toBe(false)
  })

  it('rejects shell injection attempts', () => {
    expect(SafeTool.safeParse('Read; rm -rf /').success).toBe(false)
    expect(SafeTool.safeParse('--output-format text').success).toBe(false)
    expect(SafeTool.safeParse('Bash(npm run)\nrm -rf /').success).toBe(false)
    expect(SafeTool.safeParse('Read && cat /etc/passwd').success).toBe(false)
  })

  it('rejects tool names exceeding 200 characters', () => {
    expect(SafeTool.safeParse('A'.repeat(201)).success).toBe(false)
  })
})
