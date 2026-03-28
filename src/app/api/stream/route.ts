import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { z } from 'zod'
import { DEFAULT_ALLOWED_TOOLS } from '@/lib/tools'
import { liveProcesses } from '@/lib/process-registry'
import { SafeId, SafeSessionId, SafeTool, AbsolutePath } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const StreamRequestSchema = z.object({
  agentId: SafeId,
  repoPath: AbsolutePath,
  prompt: z.string().min(1).max(500_000),
  sessionId: SafeSessionId.nullable().optional(),
  allowedTools: z.array(SafeTool).optional(),
})

interface SessionFile {
  agentId: string
  sessionId: string | null
  startedAt: number
  lastActiveAt: number
  totalCost: number
  totalRuns: number
  totalTokens: number
}

function writeSessionFile(agentId: string, update: { sessionId: string | null; cost: number; tokens: number }) {
  try {
    const dir = path.join(process.cwd(), '.fleet', 'sessions')
    mkdirSync(dir, { recursive: true })
    const filePath = path.join(dir, `${agentId}.json`)

    let existing: SessionFile = {
      agentId,
      sessionId: update.sessionId,
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
      totalCost: 0,
      totalRuns: 0,
      totalTokens: 0,
    }

    if (existsSync(filePath)) {
      try { existing = JSON.parse(readFileSync(filePath, 'utf-8')) as SessionFile } catch (e) {
        console.warn('Failed to parse session file:', e instanceof Error ? e.message : String(e))
      }
    }

    const updated: SessionFile = {
      ...existing,
      sessionId: update.sessionId ?? existing.sessionId,
      lastActiveAt: Date.now(),
      totalCost: existing.totalCost + update.cost,
      totalRuns: existing.totalRuns + 1,
      totalTokens: existing.totalTokens + update.tokens,
    }

    writeFileSync(filePath, JSON.stringify(updated, null, 2))
  } catch (e) {
    console.warn('Failed to write session file:', e instanceof Error ? e.message : String(e))
  }
}

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

  const isResume = !!sessionId

  const args = [
    '--output-format', 'stream-json',
    '--max-turns', '50',
    ...tools.flatMap(t => ['--allowedTools', t]),
  ]

  // For resumed sessions, pass prompt via -p (guaranteed CLI support).
  // For first-run, deliver via stdin to keep user content off the command line.
  if (isResume) {
    args.push('--session-id', sessionId, '--resume', '-p', prompt)
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

      // Register in the process registry so /api/kill can terminate it
      liveProcesses.set(agentId, proc)

      // For first-run (no session), deliver prompt via stdin with backpressure
      if (!isResume && proc.stdin) {
        const ok = proc.stdin.write(prompt)
        if (ok) {
          proc.stdin.end()
        } else {
          proc.stdin.once('drain', () => proc.stdin?.end())
        }
      }

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
              // Async side-effect: persist session data to disk after each completed run
              if (event.type === 'result') {
                const tokens = (event.inputTokens ?? 0) + (event.outputTokens ?? 0)
                void Promise.resolve().then(() =>
                  writeSessionFile(agentId, {
                    sessionId: event.sessionId ?? null,
                    cost: event.cost ?? 0,
                    tokens,
                  })
                )
              }
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
        liveProcesses.delete(agentId)

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
        liveProcesses.delete(agentId)
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
        liveProcesses.delete(agentId)
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
  usage?: { input_tokens?: number; output_tokens?: number }
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
