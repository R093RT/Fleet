import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { z } from 'zod'
import { DEFAULT_ALLOWED_TOOLS } from '@/lib/tools'

export const dynamic = 'force-dynamic'

const StreamRequestSchema = z.object({
  agentId: z.string(),
  repoPath: z.string(),
  prompt: z.string(),
  sessionId: z.string().nullable().optional(),
  allowedTools: z.array(z.string()).optional(),
})

export async function POST(req: NextRequest) {
  const parsed = StreamRequestSchema.safeParse(await req.json())
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten() }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const { agentId, repoPath, prompt, sessionId, allowedTools } = parsed.data

  if (!existsSync(repoPath)) {
    return new Response(JSON.stringify({ error: `Path not found: ${repoPath}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const tools = allowedTools ?? DEFAULT_ALLOWED_TOOLS

  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--max-turns', '50',
    ...tools.flatMap(t => ['--allowedTools', t]),
  ]

  // Resume existing session if we have one
  if (sessionId) {
    args.push('--session-id', sessionId, '--resume')
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const proc = spawn('claude', args, {
        cwd: repoPath,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      })

      let buffer = ''

      proc.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)
            const event = formatSSEMessage(msg, agentId)
            if (event) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
            }
          } catch {
            // Non-JSON line, send as raw text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', agentId, content: line })}\n\n`))
          }
        }
      })

      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trim()
        if (text) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'stderr', agentId, content: text })}\n\n`))
        }
      })

      proc.on('close', (code) => {
        // Flush remaining buffer
        if (buffer.trim()) {
          try {
            const msg = JSON.parse(buffer)
            const event = formatSSEMessage(msg, agentId)
            if (event) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          } catch {}
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'done',
          agentId,
          exitCode: code,
        })}\n\n`))
        controller.close()
      })

      proc.on('error', (err) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          agentId,
          content: err.message,
        })}\n\n`))
        controller.close()
      })

      // Handle client disconnect
      req.signal.addEventListener('abort', () => {
        try { proc.kill() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

interface ContentBlock {
  type: string
  text?: string
  name?: string
  input?: unknown
}

interface ClaudeStreamMessage {
  type: string
  message?: { content: ContentBlock[] }
  result?: string
  subtype?: string
  cost_usd?: number
  cost?: number
  session_id?: string
  duration_ms?: number
  content?: unknown
}

function formatSSEMessage(msg: ClaudeStreamMessage, agentId: string) {
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
