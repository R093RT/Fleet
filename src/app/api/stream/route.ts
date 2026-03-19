import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { agentId, repoPath, prompt, sessionId, allowedTools } = await req.json() as {
    agentId: string
    repoPath: string
    prompt: string
    sessionId?: string | null
    allowedTools?: string[]
  }

  if (!existsSync(repoPath)) {
    return new Response(JSON.stringify({ error: `Path not found: ${repoPath}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const tools = allowedTools || [
    'Read', 'Write', 'Edit',
    'Bash(npm run *)', 'Bash(npx *)', 'Bash(node *)',
    'Bash(git add *)', 'Bash(git commit *)', 'Bash(git status)',
    'Bash(git diff *)', 'Bash(git log *)', 'Bash(git branch *)',
    'Bash(git checkout *)', 'Bash(git stash *)',
    'Bash(cat *)', 'Bash(ls *)', 'Bash(mkdir *)', 'Bash(grep *)',
    'Bash(find *)', 'Bash(echo *)', 'Bash(head *)', 'Bash(tail *)',
    'Bash(npx prisma *)', 'Bash(npx eslint *)', 'Bash(npx jest *)',
  ]

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

function formatSSEMessage(msg: any, agentId: string) {
  // Claude Code stream-json emits various message types
  if (msg.type === 'assistant' && msg.message?.content) {
    const textBlocks = msg.message.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')

    const toolUses = msg.message.content
      .filter((b: any) => b.type === 'tool_use')
      .map((b: any) => ({ tool: b.name, input: b.input }))

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
