import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { z } from 'zod'
import { DEFAULT_ALLOWED_TOOLS, modelCliArgs } from '@/lib/tools'
import { SafeId, SafeSessionId, SafeTool, AbsolutePath } from '@/lib/validate'

const SendMessageSchema = z.object({
  repoPath: AbsolutePath,
  sessionId: SafeSessionId,
  prompt: z.string().min(1).max(500_000),
  allowedTools: z.array(SafeTool).optional(),
  agentId: SafeId.optional(),
  model: z.enum(['default', 'haiku', 'sonnet', 'opus']).optional(),
})

function runClaude(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, {
      cwd,
      env: { ...process.env },
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    // 5-minute timeout
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Process timed out after 5 minutes'))
    }, 300_000)

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: code })
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

export async function POST(req: NextRequest) {
  const parsed = SendMessageSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { repoPath, sessionId, prompt, allowedTools, model } = parsed.data

  const tools = allowedTools ?? DEFAULT_ALLOWED_TOOLS

  // send-message always resumes an existing session — use -p for guaranteed CLI support
  const args = [
    '-p', prompt,
    '--session-id', sessionId,
    '--resume',
    '--output-format', 'json',
    ...modelCliArgs(model),
    ...tools.flatMap(t => ['--allowedTools', t]),
  ]

  try {
    const result = await runClaude(args, repoPath)

    if (result.exitCode !== 0 && !result.stdout.trim()) {
      return NextResponse.json({
        success: false,
        error: result.stderr?.trim() || 'Process exited with non-zero status',
        stderr: result.stderr ?? '',
      }, { status: 500 })
    }

    const output = result.stdout
    let data: Record<string, unknown>
    try {
      data = JSON.parse(output) as Record<string, unknown>
    } catch {
      data = { result: output.trim() }
    }

    return NextResponse.json({
      success: true,
      response: typeof data['result'] === 'string' ? data['result'] : output.trim(),
      cost: data['cost'] ?? null,
      sessionId: typeof data['session_id'] === 'string' ? data['session_id'] : sessionId,
    })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
