import { NextRequest, NextResponse } from 'next/server'
import { execSync, spawn } from 'child_process'
import path from 'path'

// Track running agent processes
const agentProcesses = new Map<string, { process: ReturnType<typeof spawn>, sessionId: string | null }>()

export async function POST(req: NextRequest) {
  const { agentId, repoPath, prompt, allowedTools } = await req.json() as {
    agentId: string
    repoPath: string
    prompt: string
    allowedTools?: string[]
  }

  // Kill existing process for this agent if any
  const existing = agentProcesses.get(agentId)
  if (existing?.process) {
    try { existing.process.kill() } catch {}
    agentProcesses.delete(agentId)
  }

  const tools = allowedTools || [
    'Read', 'Write', 'Edit',
    'Bash(npm run *)', 'Bash(npx *)', 'Bash(node *)',
    'Bash(git add *)', 'Bash(git commit *)', 'Bash(git status)',
    'Bash(git diff *)', 'Bash(git log *)', 'Bash(git branch *)',
    'Bash(cat *)', 'Bash(ls *)', 'Bash(mkdir *)', 'Bash(grep *)',
    'Bash(find *)', 'Bash(echo *)',
  ]

  try {
    // Use claude -p for headless mode with streaming JSON
    const args = [
      '-p', prompt,
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

    agentProcesses.set(agentId, { process: proc, sessionId: null })

    // Stream stdout to collect session info
    proc.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          const msg = JSON.parse(line)
          if (msg.session_id) {
            sessionId = msg.session_id
            const entry = agentProcesses.get(agentId)
            if (entry) entry.sessionId = sessionId
          }
        } catch {}
      }
    })

    proc.on('close', () => {
      agentProcesses.delete(agentId)
    })

    // Wait a moment for session ID
    await new Promise(r => setTimeout(r, 1000))

    return NextResponse.json({
      success: true,
      agentId,
      sessionId: agentProcesses.get(agentId)?.sessionId || null,
      pid: proc.pid,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

// GET: check status of a running agent
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId')
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

  const entry = agentProcesses.get(agentId)
  return NextResponse.json({
    running: !!entry,
    sessionId: entry?.sessionId || null,
    pid: entry?.process.pid || null,
  })
}
