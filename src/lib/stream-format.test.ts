import { describe, it, expect } from 'vitest'
import { formatSSEMessage } from './stream-format'
import type { ClaudeStreamMessage } from './stream-format'

describe('formatSSEMessage', () => {
  const agentId = 'test-agent'

  it('formats assistant message with text blocks', () => {
    const msg: ClaudeStreamMessage = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Hello world' }] },
      session_id: 'sess-1',
    }
    const result = formatSSEMessage(msg, agentId)
    expect(result).toEqual({
      type: 'assistant',
      agentId,
      text: 'Hello world',
      toolUses: [],
      sessionId: 'sess-1',
    })
  })

  it('formats assistant message with tool_use blocks', () => {
    const msg: ClaudeStreamMessage = {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Let me read that file.' },
          { type: 'tool_use', name: 'Read', input: { path: '/foo.ts' } },
        ],
      },
    }
    const result = formatSSEMessage(msg, agentId)
    expect(result?.type).toBe('assistant')
    expect(result).toHaveProperty('toolUses')
    if (result && 'toolUses' in result) {
      expect(result.toolUses).toEqual([{ tool: 'Read', input: { path: '/foo.ts' } }])
    }
  })

  it('formats result message with cost, duration, tokens', () => {
    const msg: ClaudeStreamMessage = {
      type: 'result',
      result: 'Task complete',
      subtype: 'success',
      cost_usd: 0.0042,
      session_id: 'sess-2',
      duration_ms: 12500,
      usage: { input_tokens: 1000, output_tokens: 500 },
    }
    const result = formatSSEMessage(msg, agentId)
    expect(result).toEqual({
      type: 'result',
      agentId,
      text: 'Task complete',
      subtype: 'success',
      cost: 0.0042,
      sessionId: 'sess-2',
      duration: 12500,
      inputTokens: 1000,
      outputTokens: 500,
    })
  })

  it('formats result with fallback cost field', () => {
    const msg: ClaudeStreamMessage = {
      type: 'result',
      result: '',
      cost: 0.01,
    }
    const result = formatSSEMessage(msg, agentId)
    expect(result).toHaveProperty('cost', 0.01)
  })

  it('formats system message', () => {
    const msg: ClaudeStreamMessage = {
      type: 'system',
      subtype: 'init',
      session_id: 'sess-3',
    }
    const result = formatSSEMessage(msg, agentId)
    expect(result).toEqual({
      type: 'system',
      agentId,
      subtype: 'init',
      sessionId: 'sess-3',
    })
  })

  it('formats tool_result with string content', () => {
    const msg: ClaudeStreamMessage = {
      type: 'tool_result',
      content: 'File contents here',
    }
    const result = formatSSEMessage(msg, agentId)
    expect(result).toEqual({
      type: 'tool_result',
      agentId,
      content: 'File contents here',
    })
  })

  it('truncates tool_result object content to 500 chars', () => {
    const longContent = { data: 'x'.repeat(600) }
    const msg: ClaudeStreamMessage = {
      type: 'tool_result',
      content: longContent,
    }
    const result = formatSSEMessage(msg, agentId)
    if (result && 'content' in result && typeof result.content === 'string') {
      expect(result.content.length).toBe(500)
    }
  })

  it('returns null for unknown message type', () => {
    const msg: ClaudeStreamMessage = { type: 'unknown_type' }
    expect(formatSSEMessage(msg, agentId)).toBeNull()
  })

  it('handles missing optional fields gracefully', () => {
    const msg: ClaudeStreamMessage = {
      type: 'result',
    }
    const result = formatSSEMessage(msg, agentId)
    expect(result).toEqual({
      type: 'result',
      agentId,
      text: '',
      subtype: undefined,
      cost: null,
      sessionId: null,
      duration: null,
      inputTokens: null,
      outputTokens: null,
    })
  })
})
