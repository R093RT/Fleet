import { NextRequest, NextResponse } from 'next/server'
import { spawnSync } from 'child_process'
import { z } from 'zod'
import { DEFAULT_ALLOWED_TOOLS } from '@/lib/tools'
import { SafeId, SafeSessionId, SafeTool, AbsolutePath } from '@/lib/validate'

const SendMessageSchema = z.object({
  repoPath: AbsolutePath,
  sessionId: SafeSessionId,
  prompt: z.string().min(1),
  allowedTools: z.array(SafeTool).optional(),
  agentId: SafeId.optional(),
})

export async function POST(req: NextRequest) {
  const parsed = SendMessageSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { repoPath, sessionId, prompt, allowedTools } = parsed.data

  const tools = allowedTools ?? DEFAULT_ALLOWED_TOOLS

  // Build args array — never construct a shell string with user input
  const args = [
    '-p', prompt,
    '--session-id', sessionId,
    '--resume',
    '--output-format', 'json',
    ...tools.flatMap(t => ['--allowedTools', t]),
  ]

  const result = spawnSync('claude', args, {
    cwd: repoPath,
    encoding: 'utf-8',
    timeout: 300000, // 5 min timeout
    env: { ...process.env },
    shell: true,
  })

  if (result.error) {
    return NextResponse.json({ success: false, error: result.error.message, stderr: '' }, { status: 500 })
  }

  if (result.status !== 0) {
    return NextResponse.json({
      success: false,
      error: result.stderr?.trim() || 'Process exited with non-zero status',
      stderr: result.stderr ?? '',
    }, { status: 500 })
  }

  const output = result.stdout ?? ''
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
}
