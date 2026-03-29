export interface ContentBlock {
  type: string
  text?: string
  name?: string
  input?: unknown
}

export interface ClaudeStreamMessage {
  type: string
  message?: { content: ContentBlock[] }
  result?: string
  subtype?: string
  cost_usd?: number
  cost?: number
  session_id?: string
  duration_ms?: number
  content?: unknown
  usage?: { input_tokens?: number; output_tokens?: number }
}

export function formatSSEMessage(msg: ClaudeStreamMessage, agentId: string) {
  // Claude Code stream-json emits various message types
  if (msg.type === 'assistant' && msg.message?.content) {
    const textBlocks = msg.message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')

    const toolUses = msg.message.content
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({ tool: b.name ?? '', input: b.input }))

    return {
      type: 'assistant',
      agentId,
      text: textBlocks,
      toolUses,
      sessionId: msg.session_id || null,
    }
  }

  if (msg.type === 'result') {
    return {
      type: 'result',
      agentId,
      text: msg.result || '',
      subtype: msg.subtype, // 'success', 'error_max_turns', etc.
      cost: msg.cost_usd || msg.cost || null,
      sessionId: msg.session_id || null,
      duration: msg.duration_ms || null,
      inputTokens: msg.usage?.input_tokens ?? null,
      outputTokens: msg.usage?.output_tokens ?? null,
    }
  }

  if (msg.type === 'system') {
    return {
      type: 'system',
      agentId,
      subtype: msg.subtype,
      sessionId: msg.session_id || null,
    }
  }

  // Tool results
  if (msg.type === 'tool_result') {
    return {
      type: 'tool_result',
      agentId,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content).slice(0, 500),
    }
  }

  return null
}
