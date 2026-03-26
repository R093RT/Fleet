import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { z } from 'zod'
import { DEFAULT_ALLOWED_TOOLS } from '@/lib/tools'
import { SafeId, SafeTool, AbsolutePath } from '@/lib/validate'
import { liveProcesses } from '@/lib/process-registry'

const SpawnRequestSchema = z.object({
  agentId: SafeId,
  repoPath: AbsolutePath,
  prompt: z.string().min(1).max(500_000),
  allowedTools: z.array(SafeTool).optional(),
})

// Session IDs tracked separately (liveProcesses only stores ChildProcess)
const spawnSessionIds = new Map<string, string | null>()

export async function POST(req: NextRequest) {
  const parsed = SpawnRequestSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { agentId, repoPath, prompt, allowedTools } = parsed.data

  // Kill existing process for this agent if any (checks shared registry)
  const existing = liveProcesses.get(agentId)
  if (existing) {
    try { existing.kill() } catch {}
    liveProcesses.delete(agentId)
    spawnSessionIds.delete(agentId)
  }

  const tools = allowedTools ?? DEFAULT_ALLOWED_TOOLS

  try {
    // Use claude for headless mode with streaming JSON
    const args = [
      '--output-format', 'stream-json',
      '--max-turns', '50',
      ...tools.flatMap(t => ['--allowedTools', t]),
    ]

    const proc = spawn('claude', args, {
      cwd: repoPath,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let sessionId: string | null = null

    liveProcesses.set(agentId, proc)
    spawnSessionIds.set(agentId, null)

    // Deliver prompt via stdin to avoid shell interpretation of user content
    proc.stdin?.write(prompt)
    proc.stdin?.end()

    // Stream stdout to collect session info
    proc.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          const msg = JSON.parse(line)
          if (msg.session_id) {
            sessionId = msg.session_id
            spawnSessionIds.set(agentId, sessionId)
          }
        } catch {}
      }
    })

    proc.on('close', () => {
      liveProcesses.delete(agentId)
      spawnSessionIds.delete(agentId)
    })

    // Wait a moment for session ID
    await new Promise(r => setTimeout(r, 1000))

    return NextResponse.json({
      success: true,
      agentId,
      sessionId: spawnSessionIds.get(agentId) || null,
      pid: proc.pid,
    })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// GET: check status of a running agent
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('agentId')
  const { data: agentId, success } = SafeId.safeParse(raw)
  if (!success) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

  const proc = liveProcesses.get(agentId)
  return NextResponse.json({
    running: !!proc,
    sessionId: spawnSessionIds.get(agentId) || null,
    pid: proc?.pid || null,
  })
}
