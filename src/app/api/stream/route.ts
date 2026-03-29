import type { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { z } from 'zod'
import { DEFAULT_ALLOWED_TOOLS, modelCliArgs } from '@/lib/tools'
import { liveProcesses } from '@/lib/process-registry'
import { SafeId, SafeSessionId, SafeTool, AbsolutePath } from '@/lib/validate'
import { formatSSEMessage } from '@/lib/stream-format'
import { atomicWriteFileSync, safeReadJson } from '@/lib/atomic-write'
export const dynamic = 'force-dynamic'

const StreamRequestSchema = z.object({
  agentId: SafeId,
  repoPath: AbsolutePath,
  prompt: z.string().min(1).max(500_000),
  sessionId: SafeSessionId.nullable().optional(),
  allowedTools: z.array(SafeTool).optional(),
  model: z.enum(['default', 'haiku', 'sonnet', 'opus']).optional(),
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

    const existing: SessionFile = safeReadJson<SessionFile>(filePath) ?? {
      agentId,
      sessionId: update.sessionId,
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
      totalCost: 0,
      totalRuns: 0,
      totalTokens: 0,
    }

    const updated: SessionFile = {
      ...existing,
      sessionId: update.sessionId ?? existing.sessionId,
      lastActiveAt: Date.now(),
      totalCost: existing.totalCost + update.cost,
      totalRuns: existing.totalRuns + 1,
      totalTokens: existing.totalTokens + update.tokens,
    }

    atomicWriteFileSync(filePath, JSON.stringify(updated, null, 2))
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
  const { agentId, repoPath, prompt, sessionId, allowedTools, model } = parsed.data

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
    ...modelCliArgs(model),
  ]

  // For resumed sessions, pass prompt via -p (guaranteed CLI support).
  // For first-run, deliver via stdin to keep user content off the command line.
  if (isResume) {
    args.push('--session-id', sessionId, '--resume', '-p', prompt)
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Kill existing process for this agent if any (prevent orphans on double-send)
      const existing = liveProcesses.get(agentId)
      if (existing) {
        try { existing.kill() } catch {}
        liveProcesses.delete(agentId)
      }

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

